import type { ExportPreviewResult } from "../../shared/types.js";

type ExportPreviewProps = {
  preview: ExportPreviewResult;
  onClose: () => void;
};

const statusLabel = (hasCollision: boolean, willOverwrite: boolean) =>
  hasCollision ? "Collision" : willOverwrite ? "Overwrite" : "New";

const statusPillClass = (hasCollision: boolean, willOverwrite: boolean) =>
  `export-status-pill ${hasCollision ? "collision" : willOverwrite ? "overwrite" : "new"}`;

export const ExportPreview = ({ preview, onClose }: ExportPreviewProps) => (
  <section className="export-preview" aria-label="Export preview">
    <div className="export-preview-header">
      <div>
        <h2>Export Preview</h2>
        <span>예정 파일 {preview.items.length}개</span>
      </div>
      <div className="export-preview-status-group">
        <strong className={preview.canExport ? "export-status ready" : "export-status blocked"}>
          {preview.items.some(
            (item) =>
              item.status === "copied" || item.status === "failed" || item.status === "missing"
          )
            ? "Result"
            : preview.canExport
              ? "Ready"
              : "Blocked"}
        </strong>
        <button className="btn btn-sm" type="button" onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
    {preview.issues.length > 0 ? (
      <ul className="export-issues">
        {preview.issues.map((issue, index) => (
          <li key={`${index}-${issue.code}-${issue.photoId ?? issue.path ?? index}`}>
            {issue.message}
            {issue.path ? ` · ${issue.path}` : ""}
          </li>
        ))}
      </ul>
    ) : null}
    <div className="export-table-wrap">
      <table className="export-table">
        <thead>
          <tr>
            <th>Original</th>
            <th className="export-new-filename">New filename</th>
            <th>Day</th>
            <th>Date</th>
            <th>Route</th>
            <th>숙소</th>
            <th>원본 경로</th>
            <th>출력 경로</th>
            <th>Seq</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {preview.items.map((item) => (
            <tr key={item.photoId}>
              <td title={item.originalPath}>{item.originalFileName}</td>
              <td className="export-new-filename" title={item.outputPath}>
                {item.newFileName}
              </td>
              <td>Day {item.day.toString().padStart(2, "0")}</td>
              <td>{item.date}</td>
              <td>{item.routeText}</td>
              <td>{item.accommodation}</td>
              <td>{item.originalPath}</td>
              <td>{item.outputPath}</td>
              <td>{item.sequence}</td>
              <td>
                <span className={statusPillClass(item.hasCollision, item.willOverwrite)}>
                  {item.status === "pending"
                    ? statusLabel(item.hasCollision, item.willOverwrite)
                    : item.status}
                </span>
                {item.error && <span>{item.error}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
);
