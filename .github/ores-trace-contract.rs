//! ORES static trace-marker contract checker.
//!
//! Compatibility contract:
//!   * static trace/routine identifiers use the `ores-trace-` / `ores-routine-`
//!     prefixes and a 12..=64 character `[A-Za-z0-9_-]` suffix;
//!   * new identifiers minted by ORES tooling SHOULD use the canonical
//!     21-character nanoid width, but legacy-compatible widths remain valid;
//!   * trace identifiers stay inline at the call site;
//!   * routine identifiers are declared once per function and passed through
//!     `addRoutineId` / language equivalents;
//!   * the retired `dd-trace-` prefix and `addRoutine` spelling are rejected.
//!
//! The public wire/runtime contract admits 12..=64. Keeping admission wider
//! than the generator width avoids making a CI guard silently redefine the wire
//! contract. The self-tests pin both facts: compatibility bounds and the
//! canonical 21-character generator subset.
//!
//! The checker is intentionally lexical rather than language-specific, but it
//! distinguishes executable syntax from comments and stringified call examples.
//! Traversal and enumeration failures are fatal so a partial scan cannot report
//! success.
//!
//! Single file, no external crates.
//!
//! ores-trace-contract:ignore-file

use std::fs;
use std::path::{Path, PathBuf};
use std::process::ExitCode;

const MIN_ID_WIDTH: usize = 12;
#[cfg(test)]
const CANONICAL_GENERATOR_WIDTH: usize = 21;
const MAX_ID_WIDTH: usize = 64;

const EXTS: &[&str] = &[
    "rs", "js", "jsx", "ts", "tsx", "mjs", "cjs", "mts", "cts", "dart", "go", "java", "ex", "exs",
];

const SKIP_DIRS: &[&str] = &[
    ".git", "node_modules", "target", "dist", "build", "coverage", "vendor", "generated",
    "tests", "test", "testdata", "fixtures", "__tests__", "__mocks__", ".r2g",
];

const TRACE_METHODS: &[&str] = &[
    "addTraceId", "addTrace", "add_trace_id", "add_trace", "AddTraceID", "AddTrace",
];
const ROUTINE_METHODS: &[&str] = &["addRoutineId", "add_routine_id", "AddRoutineID"];

#[derive(Debug)]
struct Finding {
    file: String,
    line: usize,
    msg: String,
}

fn is_id_char(c: char) -> bool {
    c.is_ascii_alphanumeric() || c == '_' || c == '-'
}

fn id_ok(id: &str, kind: &str) -> bool {
    let prefix = format!("ores-{kind}-");
    match id.strip_prefix(&prefix) {
        Some(rest) => {
            let width = rest.chars().count();
            (MIN_ID_WIDTH..=MAX_ID_WIDTH).contains(&width) && rest.chars().all(is_id_char)
        }
        None => false,
    }
}

#[cfg(test)]
fn canonical_generated_id(id: &str, kind: &str) -> bool {
    let prefix = format!("ores-{kind}-");
    match id.strip_prefix(&prefix) {
        Some(rest) => {
            rest.chars().count() == CANONICAL_GENERATOR_WIDTH && rest.chars().all(is_id_char)
        }
        None => false,
    }
}

fn is_test_file(path: &Path) -> bool {
    let name = path
        .file_name()
        .map(|name| name.to_string_lossy().to_lowercase())
        .unwrap_or_default();
    name.contains(".test.")
        || name.contains(".spec.")
        || name.ends_with("_test.go")
        || name.ends_with("_test.rs")
        || name.ends_with("_test.exs")
        || name.starts_with("test_")
}

fn walk(dir: &Path, out: &mut Vec<PathBuf>) -> Result<(), String> {
    let rd = fs::read_dir(dir).map_err(|error| format!("cannot read {}: {error}", dir.display()))?;
    let mut entries = Vec::new();
    for entry in rd {
        let entry = entry.map_err(|error| format!("cannot enumerate {}: {error}", dir.display()))?;
        entries.push(entry.path());
    }
    entries.sort();

    for path in entries {
        if path.is_symlink() {
            continue;
        }
        if path.is_dir() {
            let name = path
                .file_name()
                .map(|name| name.to_string_lossy().to_string())
                .unwrap_or_default();
            if !SKIP_DIRS.contains(&name.as_str()) {
                walk(&path, out)?;
            }
        } else {
            out.push(path);
        }
    }
    Ok(())
}

fn quote_bytes(ext: &str) -> &'static [u8] {
    // Rust single quotes are also lifetimes. A char literal cannot carry one of
    // the method-shaped strings this scanner looks for, so treating only double
    // quote/backtick as Rust string delimiters avoids a lifetime hiding source.
    if ext == "rs" {
        b"\"`"
    } else {
        b"\"'`"
    }
}

/// Replace comments with spaces while preserving byte positions. Block-comment
/// state crosses line boundaries.
fn mask_comments(line: &str, ext: &str, in_block_comment: &mut bool) -> String {
    let bytes = line.as_bytes();
    let mut out = bytes.to_vec();
    let quotes = quote_bytes(ext);
    let hash_comments = matches!(ext, "ex" | "exs");
    let mut quote: Option<u8> = None;
    let mut escaped = false;
    let mut i = 0usize;

    while i < bytes.len() {
        if *in_block_comment {
            out[i] = b' ';
            if i + 1 < bytes.len() && bytes[i] == b'*' && bytes[i + 1] == b'/' {
                out[i + 1] = b' ';
                *in_block_comment = false;
                i += 2;
            } else {
                i += 1;
            }
            continue;
        }

        if let Some(q) = quote {
            if escaped {
                escaped = false;
            } else if bytes[i] == b'\\' && q != b'`' {
                escaped = true;
            } else if bytes[i] == q {
                quote = None;
            }
            i += 1;
            continue;
        }

        if quotes.contains(&bytes[i]) {
            quote = Some(bytes[i]);
            i += 1;
            continue;
        }
        if i + 1 < bytes.len() && bytes[i] == b'/' && bytes[i + 1] == b'/' {
            out[i..].fill(b' ');
            break;
        }
        if i + 1 < bytes.len() && bytes[i] == b'/' && bytes[i + 1] == b'*' {
            out[i] = b' ';
            out[i + 1] = b' ';
            *in_block_comment = true;
            i += 2;
            continue;
        }
        if hash_comments && bytes[i] == b'#' {
            out[i..].fill(b' ');
            break;
        }
        i += 1;
    }

    String::from_utf8(out).expect("comment masking preserves UTF-8")
}

fn in_string_at(line: &str, target: usize, ext: &str) -> bool {
    let bytes = line.as_bytes();
    let quotes = quote_bytes(ext);
    let mut quote: Option<u8> = None;
    let mut escaped = false;
    let mut i = 0usize;

    while i < bytes.len() && i < target {
        if let Some(q) = quote {
            if escaped {
                escaped = false;
            } else if bytes[i] == b'\\' && q != b'`' {
                escaped = true;
            } else if bytes[i] == q {
                quote = None;
            }
        } else if quotes.contains(&bytes[i]) {
            quote = Some(bytes[i]);
        }
        i += 1;
    }
    quote.is_some()
}

fn literal_arg(line: &str, at: usize, method: &str) -> Option<Option<String>> {
    let after = line.get(at + 1 + method.len()..)?;
    let rest = after.trim_start();
    if !rest.starts_with('(') {
        return None;
    }
    let rest = rest.strip_prefix('(')?.trim_start();
    let quote = rest.chars().next()?;
    if !matches!(quote, '\'' | '"' | '`') {
        return Some(None);
    }

    let mut escaped = false;
    let mut inner = String::new();
    for ch in rest[quote.len_utf8()..].chars() {
        if escaped {
            inner.push(ch);
            escaped = false;
        } else if ch == '\\' && quote != '`' {
            inner.push(ch);
            escaped = true;
        } else if ch == quote {
            return Some(Some(inner));
        } else {
            inner.push(ch);
        }
    }
    None
}

fn scan_calls(line: &str, methods: &[&str], ext: &str) -> Vec<(String, Option<String>)> {
    let mut methods = methods.to_vec();
    methods.sort_by_key(|method| std::cmp::Reverse(method.len()));
    let mut out = Vec::new();

    for (at, ch) in line.char_indices() {
        if ch != '.' || in_string_at(line, at, ext) {
            continue;
        }
        for method in &methods {
            let Some(segment) = line.get(at + 1..at + 1 + method.len()) else {
                continue;
            };
            if segment != *method {
                continue;
            }
            let next = line[at + 1 + method.len()..].chars().next();
            if matches!(next, Some(ch) if ch.is_ascii_alphanumeric() || ch == '_') {
                continue;
            }
            if let Some(arg) = literal_arg(line, at, method) {
                out.push((method.to_string(), arg));
            }
            break;
        }
    }
    out
}

fn contains_code_token(line: &str, token: &str, ext: &str) -> bool {
    let mut from = 0usize;
    while let Some(relative) = line[from..].find(token) {
        let at = from + relative;
        if !in_string_at(line, at, ext) {
            return true;
        }
        from = at + token.len();
    }
    false
}

fn is_pattern_decl(line: &str) -> bool {
    let line = line.trim_start();
    line.starts_with("@pattern")
        || line.starts_with("\"pattern\"")
        || line.starts_with("pattern =")
        || line.starts_with("pattern:")
}

fn marker_literals(line: &str) -> Vec<(String, String)> {
    let mut out = Vec::new();
    for (kind, tag) in [("trace", "ores-trace-"), ("routine", "ores-routine-")] {
        let mut from = 0usize;
        while let Some(relative) = line[from..].find(tag) {
            let start = from + relative;
            let previous = line[..start].chars().next_back();
            if matches!(previous, Some(ch) if ch.is_ascii_alphanumeric() || ch == '_' || ch == '-') {
                from = start + tag.len();
                continue;
            }
            let id: String = line[start..].chars().take_while(|ch| is_id_char(*ch)).collect();
            if id.len() > tag.len() {
                out.push((kind.to_string(), id.clone()));
            }
            from = start + id.len().max(tag.len());
        }
    }
    out
}

fn hoisted_trace_decl(line: &str) -> Option<String> {
    let mut line = line.trim();
    loop {
        let lower = line.to_lowercase();
        let stripped = [
            "pub(crate) ", "pub(super) ", "pub ", "export ", "public ", "private ",
            "protected ", "declare ",
        ]
        .iter()
        .find(|prefix| lower.starts_with(**prefix))
        .map(|prefix| line[prefix.len()..].trim_start());
        match stripped {
            Some(next) => line = next,
            None => break,
        }
    }

    let lower = line.to_lowercase();
    if !["const ", "let ", "var ", "static ", "final ", "val "]
        .iter()
        .any(|prefix| lower.starts_with(prefix))
    {
        return None;
    }

    let eq = line.find('=')?;
    let (name, rhs) = line.split_at(eq);
    let rhs = rhs[1..].trim_start();
    let quote = rhs.chars().next()?;
    if !matches!(quote, '\'' | '"' | '`') {
        return None;
    }
    let value = &rhs[quote.len_utf8()..];
    if value.starts_with("ores-trace-")
        && marker_literals(value).iter().any(|(kind, _)| kind == "trace")
    {
        return Some(name.trim().to_string());
    }
    None
}

fn next_is_mod(lines: &[&str], index: usize) -> bool {
    for line in lines.iter().skip(index + 1) {
        let line = line.trim_start();
        if line.is_empty() || line.starts_with("#[") || line.starts_with("//") {
            continue;
        }
        let after_visibility = if let Some(rest) = line.strip_prefix("pub(crate)") {
            rest.trim_start()
        } else if let Some(rest) = line.strip_prefix("pub(super)") {
            rest.trim_start()
        } else if line.starts_with("pub(in ") {
            let Some(end) = line.find(')') else {
                return false;
            };
            line[end + 1..].trim_start()
        } else if let Some(rest) = line.strip_prefix("pub") {
            rest.trim_start()
        } else {
            line
        };
        return after_visibility.starts_with("mod ");
    }
    false
}

fn check_line(file: &str, ext: &str, number: usize, line: &str, findings: &mut Vec<Finding>) {
    let push = |findings: &mut Vec<Finding>, msg: String| {
        findings.push(Finding {
            file: file.to_string(),
            line: number,
            msg,
        });
    };

    if line.contains(concat!("dd", "-trace-")) {
        push(findings, "legacy dd-trace-* marker; use ores-trace-*".into());
    }
    if contains_code_token(line, ".addRoutine(", ext)
        || contains_code_token(line, ".add_routine(", ext)
    {
        push(
            findings,
            "use addRoutineId()/add_routine_id(), not addRoutine()".into(),
        );
    }

    for (method, arg) in scan_calls(line, TRACE_METHODS, ext) {
        if let Some(id) = arg {
            if !id_ok(&id, "trace") {
                push(
                    findings,
                    format!(
                        ".{method}(\"{id}\") is not a compatible static marker; expected ^ores-trace-[A-Za-z0-9_-]{{12,64}}$"
                    ),
                );
            }
        }
    }
    for (method, arg) in scan_calls(line, ROUTINE_METHODS, ext) {
        if let Some(id) = arg {
            if !id_ok(&id, "routine") {
                push(
                    findings,
                    format!(
                        ".{method}(\"{id}\") is not a compatible routine id; expected ^ores-routine-[A-Za-z0-9_-]{{12,64}}$"
                    ),
                );
            }
        }
    }

    if let Some(binding) = hoisted_trace_decl(line) {
        push(
            findings,
            format!(
                "static ores-trace-* id must stay inline at the call site, not in `{binding}`"
            ),
        );
    }

    if !is_pattern_decl(line) {
        let already: Vec<String> = findings
            .iter()
            .filter(|finding| finding.line == number && finding.file == file)
            .map(|finding| finding.msg.clone())
            .collect();
        for (kind, id) in marker_literals(line) {
            if already.iter().any(|message| message.contains(&format!("\"{id}\""))) {
                continue;
            }
            if !id_ok(&id, &kind) {
                push(
                    findings,
                    format!(
                        "\"{id}\" does not match ^ores-{kind}-[A-Za-z0-9_-]{{12,64}}$"
                    ),
                );
            }
        }
    }
}

fn vacuous_scan(root: &Path, checked: usize) -> Option<String> {
    if !root.is_dir() {
        return Some(format!("root {} is not a directory", root.display()));
    }
    if checked == 0 {
        return Some(format!(
            "no source files were checked under {}; refusing to report a scan that covered nothing",
            root.display()
        ));
    }
    None
}

fn main() -> ExitCode {
    let root = PathBuf::from(std::env::args().nth(1).unwrap_or_else(|| ".".to_string()));
    let mut files = Vec::new();
    if let Err(reason) = walk(&root, &mut files) {
        eprintln!("ores-trace-contract: REFUSED -- {reason}");
        return ExitCode::FAILURE;
    }

    let mut findings = Vec::new();
    let mut checked = 0usize;
    let mut marker_lines = 0usize;

    for path in files {
        let Some(ext) = path
            .extension()
            .map(|extension| extension.to_string_lossy().to_lowercase())
        else {
            continue;
        };
        if !EXTS.contains(&ext.as_str()) || is_test_file(&path) {
            continue;
        }

        let relative = path.strip_prefix(&root).unwrap_or(&path).display().to_string();
        let text = match fs::read_to_string(&path) {
            Ok(text) => text,
            Err(error) => {
                findings.push(Finding {
                    file: relative,
                    line: 0,
                    msg: format!("source file could not be read as UTF-8: {error}"),
                });
                continue;
            }
        };
        if text.contains("ores-trace-contract:ignore-file") {
            continue;
        }

        checked += 1;
        let lines: Vec<&str> = text.lines().collect();
        let mut in_block_comment = false;
        for (index, line) in lines.iter().enumerate() {
            if ext == "rs" && line.trim_start().starts_with("#[cfg(test)]") && next_is_mod(&lines, index) {
                break;
            }
            let visible = mask_comments(line, &ext, &mut in_block_comment);
            if visible.contains("ores-trace-") || visible.contains("ores-routine-") {
                marker_lines += 1;
            }
            check_line(&relative, &ext, index + 1, &visible, &mut findings);
        }
    }

    if let Some(reason) = vacuous_scan(&root, checked) {
        eprintln!("ores-trace-contract: REFUSED -- {reason}");
        return ExitCode::FAILURE;
    }
    if findings.is_empty() {
        println!(
            "ores-trace-contract: OK -- {checked} source files checked, {marker_lines} marker lines, 0 violations"
        );
        return ExitCode::SUCCESS;
    }

    eprintln!("ores-trace-contract: {} violation(s)", findings.len());
    for finding in findings {
        eprintln!("  {}:{}: {}", finding.file, finding.line, finding.msg);
    }
    ExitCode::FAILURE
}

#[cfg(test)]
mod tests {
    use super::*;

    fn id(kind: &str, width: usize) -> String {
        format!("ores-{kind}-{}", "A".repeat(width))
    }

    fn messages_for(ext: &str, line: &str) -> Vec<String> {
        let mut block = false;
        let visible = mask_comments(line, ext, &mut block);
        let mut findings = Vec::new();
        check_line("x.rs", ext, 1, &visible, &mut findings);
        findings.into_iter().map(|finding| finding.msg).collect()
    }

    fn messages(line: &str) -> Vec<String> {
        messages_for("rs", line)
    }

    #[test]
    fn compatibility_boundary_matrix_is_pinned() {
        for width in [11usize, 65] {
            assert!(!id_ok(&id("trace", width), "trace"));
            assert!(!id_ok(&id("routine", width), "routine"));
        }
        for width in [12usize, 20, 21, 22, 41, 64] {
            assert!(id_ok(&id("trace", width), "trace"));
            assert!(id_ok(&id("routine", width), "routine"));
        }
        assert!(!id_ok("ores-trace-AAAAAAAAAAA!", "trace"));
        assert!(!id_ok(&id("routine", 21), "trace"));
    }

    #[test]
    fn canonical_generator_width_is_an_admitted_subset() {
        let trace = id("trace", CANONICAL_GENERATOR_WIDTH);
        let routine = id("routine", CANONICAL_GENERATOR_WIDTH);
        assert!(canonical_generated_id(&trace, "trace") && id_ok(&trace, "trace"));
        assert!(canonical_generated_id(&routine, "routine") && id_ok(&routine, "routine"));
        assert!(!canonical_generated_id(&id("trace", 20), "trace"));
        assert!(!canonical_generated_id(&id("trace", 22), "trace"));
    }

    #[test]
    fn compatible_call_site_widths_pass_and_boundaries_fail() {
        for width in [12usize, 21, 41, 64] {
            assert!(messages(&format!(
                "l.info(\"x\").add_trace(\"{}\", false);",
                id("trace", width)
            ))
            .is_empty());
        }
        assert!(!messages(&format!(
            "l.info(\"x\").add_trace(\"{}\", false);",
            id("trace", 11)
        ))
        .is_empty());
        assert!(!messages(&format!(
            "l.info(\"x\").add_trace(\"{}\", false);",
            id("trace", 65)
        ))
        .is_empty());
    }

    #[test]
    fn call_like_text_in_strings_and_comments_is_not_executable() {
        let valid = id("trace", 21);
        assert!(messages(&format!(
            "let example = \"logger.add_trace(\\\"{valid}\\\", false)\";"
        ))
        .is_empty());
        assert!(messages("let x = 1; // logger.add_trace(\"ores-trace-SHORT\", false)").is_empty());
        assert!(messages("let x = 1; /* logger.add_trace(\"ores-trace-SHORT\", false) */ let y = 2;").is_empty());
        assert!(messages("let s = \".addRoutine(ROUTINE_ID)\";").is_empty());
    }

    #[test]
    fn multiline_block_comments_stay_masked() {
        let mut block = false;
        let first = mask_comments(
            "let x = 1; /* logger.add_trace(\"ores-trace-SHORT\", false)",
            "rs",
            &mut block,
        );
        assert!(block);
        let middle = mask_comments(
            "logger.add_trace(\"ores-trace-SHORT\", false)",
            "rs",
            &mut block,
        );
        assert!(block);
        let last = mask_comments("*/ let y = 2;", "rs", &mut block);
        assert!(!block);
        for visible in [first, middle, last] {
            let mut findings = Vec::new();
            check_line("x.rs", "rs", 1, &visible, &mut findings);
            assert!(findings.is_empty(), "{visible:?}");
        }
    }

    #[test]
    fn hash_comments_are_masked_without_hiding_rust_attributes() {
        assert!(messages_for("ex", "#logger.add_trace(\"ores-trace-SHORT\")").is_empty());
        let mut block = false;
        assert_eq!(mask_comments("#[derive(Debug)]", "rs", &mut block), "#[derive(Debug)]");
    }

    #[test]
    fn matcher_needles_do_not_hide_real_calls_or_hoisted_ids() {
        let line = format!(
            "if p.contains(\"/health\") {{ l.info(\"x\").add_trace(\"{}\", false); }}",
            id("trace", 11)
        );
        assert!(!messages(&line).is_empty());
        let good = id("trace", 21);
        assert!(!messages(&format!(
            "const ID: &str = \"{good}\"; let _ = p.contains(\"x\");"
        ))
        .is_empty());
    }

    #[test]
    fn cfg_test_modules_accept_restricted_visibility_spellings() {
        assert!(next_is_mod(&["#[cfg(test)]", "mod tests {"], 0));
        assert!(next_is_mod(&["#[cfg(test)]", "pub mod tests {"], 0));
        assert!(next_is_mod(&["#[cfg(test)]", "pub(crate) mod tests {"], 0));
        assert!(next_is_mod(&["#[cfg(test)]", "pub(super) mod tests {"], 0));
        assert!(next_is_mod(&["#[cfg(test)]", "pub(in crate) mod tests {"], 0));
        assert!(!next_is_mod(&["#[cfg(test)]", "use std::fmt;", "pub fn real() {}"], 0));
    }

    #[test]
    fn prefix_constants_headers_and_pattern_declarations_are_not_violations() {
        assert!(messages("const TracePrefix = \"ores-trace-\";").is_empty());
        assert!(messages("const TRACE_HEADER: &str = \"x-ores-trace-id\";").is_empty());
        assert!(messages("// historical ores-trace-abc").is_empty());
        assert!(messages("#[pattern(\"^ores-trace-[A-Za-z0-9_-]{12,64}$\")]").is_empty());
    }

    #[test]
    fn every_direct_hoisted_trace_binding_is_rejected_but_routine_constants_are_allowed() {
        let good = id("trace", 21);
        assert!(hoisted_trace_decl(&format!("pub const SHARED_TRACE: &str = \"{good}\";")).is_some());
        assert!(hoisted_trace_decl(&format!("const ID: &str = \"{good}\";")).is_some());
        assert!(hoisted_trace_decl(&format!("pub(crate) static X: &str = \"{good}\";")).is_some());
        assert!(hoisted_trace_decl(&format!("let note = \"historical {good}\";")).is_none());
        assert!(messages(&format!(
            "const ROUTINE_ID: &str = \"{}\";",
            id("routine", 21)
        ))
        .is_empty());
    }

    #[test]
    fn retired_prefix_and_wrong_method_are_rejected_only_in_source() {
        let dd = format!(
            "l.add_trace(\"{}\", false);",
            concat!("dd", "-trace-abcdefghijkl")
        );
        assert!(!messages(&dd).is_empty());
        assert!(messages("l.addRoutine(ROUTINE_ID);")
            .iter()
            .any(|message| message.contains("addRoutineId")));
        assert!(messages("// l.addRoutine(ROUTINE_ID);").is_empty());
        assert!(messages("let note = \".addRoutine(ROUTINE_ID)\";").is_empty());
    }

    #[test]
    fn longer_method_identifiers_are_not_call_sites() {
        assert!(scan_calls("x.addTraceIdFrom(ctx)", TRACE_METHODS, "rs").is_empty());
    }

    #[test]
    fn vacuous_scans_fail_closed() {
        assert!(vacuous_scan(Path::new("/nonexistent/ores-trace-contract-root"), 0).is_some());
        assert!(vacuous_scan(Path::new("."), 0).is_some());
        assert!(vacuous_scan(Path::new("."), 1).is_none());
    }
}
