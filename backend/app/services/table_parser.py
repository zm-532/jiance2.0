import re
import html


def strip_html(text: str) -> str:
    text = re.sub(r"<[^>]+>", "", text)
    return html.unescape(text).strip()


def parse_html_tables(markdown: str) -> list[dict]:
    """Extract structured tables from HTML within OCR markdown output.

    Port of the old backend's parseHtmlTables() from JS to Python.
    Returns a list of {rows: [[cell, ...], ...]} dicts.
    """
    if not markdown:
        return []

    # Normalize HTML
    normalized = markdown
    normalized = re.sub(r"<br\s*/?>", " ", normalized)
    normalized = normalized.replace("&nbsp;", " ")
    # Fix truncated <td> remnants
    normalized = re.sub(r"<td[^>]*>\s*</td[^>]*>", "<td></td>", normalized)

    # Extract <table> blocks
    table_pattern = re.compile(r"<table[^>]*>([\s\S]*?)</table>", re.IGNORECASE)
    tables = []

    for match in table_pattern.finditer(normalized):
        table_html = match.group(1)
        rows = _extract_rows(table_html)
        if rows:
            tables.append({"rows": rows})

    return tables


def _extract_rows(table_html: str) -> list[list[str]]:
    row_pattern = re.compile(r"<tr[^>]*>([\s\S]*?)</tr>", re.IGNORECASE)
    cell_pattern = re.compile(r"<t[dh][^>]*>([\s\S]*?)</t[dh]>", re.IGNORECASE)
    colspan_pattern = re.compile(r'colspan\s*=\s*["\']?(\d+)', re.IGNORECASE)

    rows = []
    for row_match in row_pattern.finditer(table_html):
        row_html = row_match.group(1)
        cells = []
        for cell_match in cell_pattern.finditer(row_html):
            cell_tag = cell_match.group(0)
            cell_text = strip_html(cell_match.group(1))

            # Handle colspan by duplicating cell
            colspan_m = colspan_pattern.search(cell_tag)
            colspan = int(colspan_m.group(1)) if colspan_m else 1
            for _ in range(max(1, colspan)):
                cells.append(cell_text)

        if cells:
            rows.append(cells)

    return rows
