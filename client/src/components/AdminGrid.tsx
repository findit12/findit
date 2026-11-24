import { AllCommunityModule, ModuleRegistry, themeQuartz, type ColDef } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';

// AG Grid needs its features to be registered once (sort, filter, pagination...).
ModuleRegistry.registerModules([AllCommunityModule]);

// The AG Grid look, with the colors of FindIt.
const findItTheme = themeQuartz.withParams({
  accentColor: '#ce1052',
  headerBackgroundColor: '#fce7ef',
  headerTextColor: '#5c061e',
  borderRadius: 10,
  fontFamily: 'inherit',
});

// Every column can be sorted and filtered, and is resizable (FR-19: "sort, filter, pagination").
const defaultColDef: ColDef = { sortable: true, filter: true, resizable: true, flex: 1, minWidth: 110 };

interface AdminGridProps<Row> {
  rows: Row[];
  columns: ColDef<Row>[];
  // Shown when there is no row.
  emptyText: string;
}

// SRS 2.2 and SDD 3.4 "Goodie 1": the admin tables (moderation queue, users...) use AG Grid,
// 10 rows per page. The table grows with its rows (domLayout "autoHeight").
export default function AdminGrid<Row>({ rows, columns, emptyText }: AdminGridProps<Row>) {
  return (
    <div className="admin-grid">
      <AgGridReact<Row>
        theme={findItTheme}
        rowData={rows}
        columnDefs={columns}
        defaultColDef={defaultColDef}
        pagination
        paginationPageSize={10}
        paginationPageSizeSelector={[10, 20, 50]}
        domLayout="autoHeight"
        overlayNoRowsTemplate={`<span>${emptyText}</span>`}
      />
    </div>
  );
}
