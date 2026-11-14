import type { PhotoItem } from "../../shared/types.js";

type PhotoGridProps = {
  title: string;
  schedule: import("../../shared/types.js").ScheduleDay[];
  thumbnailSize: number;
  onMoveSelected: (day: number | undefined) => void;
  photos: PhotoItem[];
  selectedPhotoId?: string;
  onPhotoFocus: (photoId: string) => void;
  onToggleSelected: (photoId: string) => void;
  onSelectAllVisible: () => void;
  onDeselectAllVisible: () => void;
};

const formatAssignedDay = (photo: PhotoItem) =>
  photo.assignedDay ? `Day ${photo.assignedDay.toString().padStart(2, "0")}` : "Unmatched";

const getCaptureLabel = (photo: PhotoItem) =>
  photo.effectiveDateTime ||
  photo.dateTimeOriginal ||
  photo.createDate ||
  photo.fileModifyDate ||
  "시간 정보 없음";

const getThumbnailSource = (photo: PhotoItem) => photo.thumbnailUrl ?? photo.thumbnailPath;

const reviewBadgeLabel = (photo: PhotoItem) => {
  switch (photo.reviewReason) {
    case "missing_exif":
      return "EXIF 없음";
    case "missing_file":
      return "파일 없음";
    case "damaged_file":
      return "손상됨";
    default:
      return "검토 필요";
  }
};

export const PhotoGrid = ({
  title,
  schedule,
  thumbnailSize,
  onMoveSelected,
  photos,
  selectedPhotoId,
  onPhotoFocus,
  onToggleSelected,
  onSelectAllVisible,
  onDeselectAllVisible
}: PhotoGridProps) => (
  <section className="photo-grid" aria-label="Photo thumbnails">
    <div className="grid-header">
      <div>
        <h2>{title}</h2>
        <span>{photos.length}장</span>
      </div>
      <div className="grid-actions">
        <label>
          선택한 표시 사진 이동
          <select
            aria-label="선택한 표시 사진 이동"
            value=""
            onChange={(e) => {
              if (e.target.value)
                onMoveSelected(e.target.value === "unmatched" ? undefined : Number(e.target.value));
            }}
          >
            <option value="">목적지 선택</option>
            <option value="unmatched">Unmatched</option>
            {schedule.map((day) => (
              <option key={day.day} value={day.day}>
                Day {day.day} — {day.displayTitle}
              </option>
            ))}
          </select>
        </label>
        <button className="btn btn-sm" type="button" onClick={onSelectAllVisible}>
          모두 선택
        </button>
        <button className="btn btn-sm" type="button" onClick={onDeselectAllVisible}>
          모두 선택 해제
        </button>
      </div>
    </div>
    <div
      className="thumbnail-grid"
      style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${thumbnailSize}px, 1fr))` }}
    >
      {photos.map((photo) => (
        <article
          className={photo.id === selectedPhotoId ? "thumbnail-card active" : "thumbnail-card"}
          key={photo.id}
          onClick={() => onPhotoFocus(photo.id)}
        >
          <div className="thumbnail-preview">
            {getThumbnailSource(photo) ? (
              <img src={getThumbnailSource(photo)} alt="" loading="lazy" />
            ) : (
              <span>{photo.extension.replace(".", "").toUpperCase()}</span>
            )}
            <button
              className={photo.selected ? "selection-dot selected" : "selection-dot"}
              type="button"
              aria-label={photo.selected ? "선택 해제" : "선택"}
              onClick={(event) => {
                event.stopPropagation();
                onToggleSelected(photo.id);
              }}
            />
            {photo.needsUserReview ? (
              <span className="review-badge">{reviewBadgeLabel(photo)}</span>
            ) : null}
          </div>
          <div className="thumbnail-meta">
            <strong>{photo.fileName}</strong>
            <span className={photo.assignedDay ? "day-pill" : "day-pill unassigned"}>
              {formatAssignedDay(photo)}
            </span>
            <span className="capture-label">{getCaptureLabel(photo)}</span>
          </div>
        </article>
      ))}
    </div>
  </section>
);
