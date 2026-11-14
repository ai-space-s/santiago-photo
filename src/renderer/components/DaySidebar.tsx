import type { PhotoItem, ScheduleDay } from "../../shared/types.js";

export type PhotoViewFilter =
  | "rest"
  | "walking"
  | "all"
  | "unmatched"
  | "selected"
  | "unselected"
  | "manual"
  | "exif"
  | "missing-exif"
  | `day:${number}`;

type DaySidebarProps = {
  schedule: ScheduleDay[];
  photos: PhotoItem[];
  activeView: PhotoViewFilter;
  onViewChange: (view: PhotoViewFilter) => void;
};

const countForDay = (photos: PhotoItem[], day: number) => {
  const dayPhotos = photos.filter((photo) => photo.assignedDay === day);

  return {
    total: dayPhotos.length,
    selected: dayPhotos.filter((photo) => photo.selected).length
  };
};

export const DaySidebar = ({ schedule, photos, activeView, onViewChange }: DaySidebarProps) => {
  const statusFilters: Array<[PhotoViewFilter, string, (photo: PhotoItem) => boolean]> = [
    [
      "rest",
      "Rest Days",
      (photo) => schedule.some((day) => day.day === photo.assignedDay && day.dayType === "rest")
    ],
    [
      "walking",
      "Walking Days",
      (photo) => schedule.some((day) => day.day === photo.assignedDay && day.dayType === "walking")
    ],
    ["all", "전체 사진", () => true],
    ["unmatched", "Unmatched", (photo) => photo.assignedDay === undefined],
    ["selected", "선택됨", (photo) => photo.selected],
    ["unselected", "선택 안됨", (photo) => !photo.selected],
    ["manual", "수동 배정", (photo) => photo.matchSource === "manual"],
    [
      "exif",
      "EXIF 자동 배정",
      (photo) => photo.assignedDay !== undefined && photo.matchSource !== "manual"
    ],
    ["missing-exif", "EXIF 누락 검토", (photo) => photo.reviewReason === "missing_exif"]
  ];

  const itemClass = (view: PhotoViewFilter) =>
    activeView === view ? "sidebar-item active" : "sidebar-item";

  return (
    <aside className="sidebar" aria-label="Day navigation">
      <div className="sidebar-section">
        <div className="sidebar-section-header">상태별</div>
        {statusFilters.map(([view, label, predicate]) => (
          <button
            className={itemClass(view)}
            key={view}
            type="button"
            onClick={() => onViewChange(view)}
          >
            <span>{label}</span>
            <strong>{photos.filter(predicate).length}</strong>
          </button>
        ))}
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-header">Day별</div>
        <div className="day-list">
          {schedule.map((day) => {
            const count = countForDay(photos, day.day);
            const view = `day:${day.day}` as const;

            return (
              <button
                className={activeView === view ? "day-item active" : "day-item"}
                key={day.day}
                type="button"
                onClick={() => onViewChange(view)}
              >
                <span className="day-item-main">
                  <span className="day-item-heading">
                    <span className="day-label">Day {day.day.toString().padStart(2, "0")}</span>
                    <span className={`day-type-tag ${day.dayType === "rest" ? "rest" : "walking"}`}>
                      {day.dayType === "rest" ? "휴식" : "도보"}
                    </span>
                  </span>
                  <span className="day-title">{day.displayTitle}</span>
                </span>
                <strong>
                  {count.total} / {count.selected}
                </strong>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
};
