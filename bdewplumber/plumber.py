import re


def extract_mig_tables(pdf):
    index_page = pdf.pages[0]
    index_table = index_page.extract_table()
    index_data = list(extract_index_table(index_table))
    segment_layout_i, segment_layout_page = next(
        (i, page) for i, (label, page) in enumerate(index_data)
        if label == "Segmentlayout"
    )
    segment_layout_stop_page = index_data[segment_layout_i + 1][1]
    previous_table = None
    for pages_i in range(segment_layout_page, segment_layout_stop_page):
        page = pdf.pages[pages_i]
        table = page.extract_table()
        if not previous_table:
            previous_table = table
            first_row = table[0]
            continue
        if table[0] != first_row:
            previous_table += table
            continue
        yield extract_segment_layout_table(previous_table)
        previous_table = table
    yield extract_segment_layout_table(previous_table)


def extract_index_table(table):
    first_row = next(
        i for i, row in enumerate(table)
        if "...." in row[0]
    )
    stop_row = first_row + 1 + next(
        i for i, row in enumerate(table[first_row + 1:])
        if "...." not in row[0]
    )
    for row in table[first_row:stop_row]:
        title, page_str = re.match(r"(.+?) ?\.+ ?(\d+)", row[0]).groups()
        yield title, int(page_str)


def extract_segment_layout_table(table):
    main_table_row = 4
    while not(val0 := table[main_table_row][0]) or is_int(val0):
        main_table_row += 1
    header_table = table[1:main_table_row]
    try:
        notes_row = next(
            i for i in range(main_table_row, len(table))
            if all(col is None for col in table[i][1:])
        )
    except StopIteration:
        main_table = table[main_table_row:]
        notes_table = []
    else:
        main_table = table[main_table_row:notes_row]
        notes_table = table[notes_row:]
    return extract_main_data(main_table)


def is_int(text):
    try:
        int(text[:4])
    except ValueError:
        return False
    return True


def extract_main_data(table):
    columns_labels = []
    current_label0 = None
    for label0, label1 in zip(table[0], table[1]):
        if label0:
            current_label0 = label0
        columns_labels.append(
            label1 and (current_label0, label1)
        )
    has_none = None in columns_labels
    data = []
    for row in table[2:]:
        row_data = dict(zip(columns_labels, row))
        if has_none:
            del row_data[None]
        if row[0]:
            data.append(row_data)
        else:
            merge_rows(data[-1], row_data)
    return data


def merge_rows(target, new_row):
    for key, value in new_row.items():
        if value:
            target[key] += "\n" + value
