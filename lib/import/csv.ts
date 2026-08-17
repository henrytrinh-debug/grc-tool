/** Minimal CSV parser that understands quoted fields and UTF-8 BOM. */
export function parseCsv(text: string): string[][] {
  const input = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      row.push(cell);
      cell = "";
      continue;
    }

    if (char === "\n") {
      row.push(cell);
      if (row.some((value) => value.trim())) {
        rows.push(row);
      }
      row = [];
      cell = "";
      continue;
    }

    if (char === "\r") {
      continue;
    }

    cell += char;
  }

  row.push(cell);
  if (row.some((value) => value.trim())) {
    rows.push(row);
  }

  return rows;
}

export function csvToObjects(rows: string[][]) {
  const [headerRow, ...body] = rows;
  if (!headerRow) {
    return { headers: [] as string[], records: [] as Array<Record<string, string>> };
  }

  const headers = headerRow.map((header) => header.trim());
  const records = body.map((row) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = (row[index] ?? "").trim();
    });
    return record;
  });

  return { headers, records };
}

export function objectsToCsv(
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>,
) {
  return [headers, ...rows]
    .map((row) =>
      row
        .map((value) => {
          const text = value == null ? "" : String(value);
          if (/[",\n]/.test(text)) {
            return `"${text.replaceAll('"', '""')}"`;
          }
          return text;
        })
        .join(","),
    )
    .join("\n");
}
