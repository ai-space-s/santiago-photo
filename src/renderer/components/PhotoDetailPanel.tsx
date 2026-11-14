import { createOriginalPhotoUrl } from "../photoUrl.js";
import type { PhotoCategory, PhotoItem, ScheduleDay } from "../../shared/types.js";
import { PHOTO_CATEGORIES } from "../../shared/slideshow.js";

type PhotoDetailPanelProps = {
  photo?: PhotoItem;
  schedule: ScheduleDay[];
  canGoPrevious: boolean;
  canGoNext: boolean;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onMovePhoto: (photoId: string, day: number | undefined) => void;
  onMoveOrder: (photoId: string, direction: "up" | "down") => void;
  onCategoryChange: (photoId: string, category: PhotoCategory | undefined) => void;
};

const formatBytes = (bytes: number) => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getThumbnailSource = (photo: PhotoItem) => photo.thumbnailUrl ?? photo.thumbnailPath;

const formatCaptureDateTime = (isoLike?: string) => {
  const match = isoLike?.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);

  if (!match) {
    return undefined;
  }

  const [, , month, day, hour, minute] = match;

  return {
    dateLabel: `${Number(month)}월 ${Number(day)}일`,
    timeLabel: `${hour}:${minute}`
  };
};

export const PhotoDetailPanel = ({
  photo,
  schedule,
  canGoPrevious,
  canGoNext,
  onClose,
  onPrevious,
  onNext,
  onMovePhoto,
  onMoveOrder,
  onCategoryChange
}: PhotoDetailPanelProps) => {
  if (!photo) {
    return null;
  }

  const assignedDay = schedule.find((day) => day.day === photo.assignedDay);
  const thumbnailSource = getThumbnailSource(photo);
  const previewSource = photo.originalPath
    ? createOriginalPhotoUrl(photo.originalPath)
    : thumbnailSource;
  const extensionLabel = photo.extension.replace(".", "").toUpperCase();
  const dayHeadingLabel = assignedDay
    ? `Day ${assignedDay.day.toString().padStart(2, "0")} · ${assignedDay.displayTitle}`
    : "Unmatched";
  const captureDateTime = formatCaptureDateTime(photo.effectiveDateTime ?? photo.dateTimeOriginal);

  return (
    <div
      className="photo-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section className="photo-modal" role="dialog" aria-modal="true" aria-label="Photo details">
        <button className="modal-close-button" type="button" aria-label="닫기" onClick={onClose}>
          ✕
        </button>

        <header className="modal-header">
          <div className="modal-header-text">
            <h2>{dayHeadingLabel}</h2>
            <span title={photo.originalPath}>{photo.originalPath}</span>
          </div>
          {captureDateTime ? (
            <div className="modal-capture-badge">
              <span className="badge-date">{captureDateTime.dateLabel}</span>
              <span className="badge-time">{captureDateTime.timeLabel}</span>
            </div>
          ) : null}
        </header>

        <div className="modal-body">
          <button
            className="modal-nav-button previous"
            type="button"
            aria-label="이전 사진"
            disabled={!canGoPrevious}
            onClick={onPrevious}
          >
            ‹
          </button>
          <button
            className="modal-nav-button next"
            type="button"
            aria-label="다음 사진"
            disabled={!canGoNext}
            onClick={onNext}
          >
            ›
          </button>
          <div className="modal-preview">
            {previewSource ? (
              <img
                src={previewSource}
                alt=""
                onError={(event) => {
                  if (thumbnailSource && event.currentTarget.src !== thumbnailSource) {
                    event.currentTarget.src = thumbnailSource;
                  }
                }}
              />
            ) : (
              <span>{extensionLabel} preview</span>
            )}
          </div>
        </div>

        <div className="modal-info-bar">
          <dl className="modal-info-grid">
            <div className="info-field">
              <dt>파일명</dt>
              <dd>{photo.fileName}</dd>
            </div>
            <div className="info-field">
              <dt>파일 크기</dt>
              <dd>{formatBytes(photo.fileSize)}</dd>
            </div>
            <div className="info-field">
              <dt>촬영 시각 (DateTimeOriginal)</dt>
              <dd>{photo.dateTimeOriginal ?? "-"}</dd>
            </div>
            <div className="info-field">
              <dt>보정된 배정 시각</dt>
              <dd>{photo.effectiveDateTime ?? "-"}</dd>
            </div>
          </dl>

          <div className="modal-info-controls">
            <label className="move-control">
              사진 유형
              <select
                aria-label="사진 유형"
                value={photo.category ?? "uncategorized"}
                onChange={(event) =>
                  onCategoryChange(
                    photo.id,
                    event.target.value === "uncategorized"
                      ? undefined
                      : (event.target.value as PhotoCategory)
                  )
                }
              >
                {Object.entries(PHOTO_CATEGORIES).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="move-control">
              Day 이동
              <select
                value={photo.assignedDay ?? ""}
                onChange={(event) =>
                  onMovePhoto(photo.id, event.target.value ? Number(event.target.value) : undefined)
                }
              >
                <option value="">Unmatched</option>
                {schedule.map((day) => (
                  <option value={day.day} key={day.day}>
                    Day {day.day.toString().padStart(2, "0")} - {day.displayTitle}
                  </option>
                ))}
              </select>
            </label>
            <div className="detail-move-row">
              <button type="button" onClick={() => onMoveOrder(photo.id, "up")}>
                ◂ 순서 앞으로
              </button>
              <button type="button" onClick={() => onMoveOrder(photo.id, "down")}>
                순서 뒤로 ▸
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
