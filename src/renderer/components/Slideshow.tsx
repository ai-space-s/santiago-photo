import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildSlideshow,
  normalizeSlideshowSettings,
  PHOTO_CATEGORIES,
  slideshowTimestamp
} from "../../shared/slideshow";
import type { SlideshowSlide } from "../../shared/slideshow";
import type { PhotoItem, ScheduleDay, SlideshowSettings } from "../../shared/types";
import { createOriginalPhotoUrl } from "../photoUrl";
import "../styles/slideshow.css";

type Props = {
  photos: PhotoItem[];
  schedule: ScheduleDay[];
  projectName: string;
  settings?: SlideshowSettings;
  currentDay?: number;
  onSettingsChange: (settings: SlideshowSettings) => void;
  onClose: () => void;
};

const dayLabel = (day: ScheduleDay) => `Day ${String(day.day).padStart(2, "0")}`;
const durationLabel = (seconds: number) =>
  `${Math.floor(seconds / 60)}분 ${Math.round(seconds % 60)}초`;

export const Slideshow = ({
  photos,
  schedule,
  projectName,
  settings,
  currentDay,
  onSettingsChange,
  onClose
}: Props) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState(() => normalizeSlideshowSettings(settings));
  const [session, setSession] = useState<{
    slides: SlideshowSlide[];
    settings: SlideshowSettings;
  }>();
  // Preview uses stable random values: start creates the actual shuffled playlist once.
  const plan = useMemo(
    () => buildSlideshow(photos, schedule, draft, () => 0.5),
    [photos, schedule, draft]
  );
  const change = (patch: Partial<SlideshowSettings>) =>
    setDraft((value) => ({ ...value, ...patch }));
  const close = () => {
    onSettingsChange(normalizeSlideshowSettings(draft));
    onClose();
  };

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      previousFocus?.focus();
    };
  }, []);

  const start = () => {
    const normalized = normalizeSlideshowSettings(draft);
    const result = buildSlideshow(photos, schedule, normalized);
    if (!result.photoCount) return;
    onSettingsChange(normalized);
    setSession({ slides: result.slides, settings: normalized });
  };

  return (
    <dialog
      ref={dialogRef}
      className={`slideshow-dialog ${session ? "is-playing" : ""}`}
      aria-label={session ? "슬라이드쇼 재생" : "슬라이드쇼 구성"}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      {session ? (
        <SlideshowPlayer
          slides={session.slides}
          settings={session.settings}
          projectName={projectName}
          onClose={close}
          onConfigure={() => {
            if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
            setSession(undefined);
          }}
        />
      ) : (
        <div className="slideshow-setup">
          <header className="slideshow-setup-header">
            <div>
              <span className="slideshow-eyebrow">CAMINO · YOUR JOURNEY</span>
              <h2>슬라이드쇼 구성</h2>
              <p>하루의 표지부터 한 장의 기억까지, 순례길을 다시 걸어보세요.</p>
            </div>
            <button type="button" className="btn" onClick={close} aria-label="슬라이드쇼 닫기">
              닫기 ✕
            </button>
          </header>
          <div className="slideshow-setup-grid">
            <section className="slideshow-options" aria-label="사진 구성 설정">
              <label>
                사진 범위
                <select
                  aria-label="사진 범위"
                  value={draft.source}
                  onChange={(e) =>
                    change({ source: e.target.value as SlideshowSettings["source"] })
                  }
                >
                  <option value="all">전체 사진</option>
                  <option value="selected">선택한 사진만</option>
                </select>
              </label>
              <label>
                Day 안의 사진 순서
                <select
                  aria-label="Day 안의 사진 순서"
                  value={draft.order}
                  onChange={(e) => change({ order: e.target.value as SlideshowSettings["order"] })}
                >
                  <option value="chronological">시간순</option>
                  <option value="manual">사용자 지정 순서</option>
                  <option value="shuffle">무작위 순서</option>
                </select>
              </label>
              <p className="slideshow-help">
                시간순은 보정된 시각을 우선하며 시각이 없으면 마지막에 표시합니다. 사용자 지정
                순서는 사진 상세 화면의 ‘순서 앞으로 / 뒤로’를 따릅니다.
              </p>
              <fieldset>
                <legend>
                  사진 유형 <small>선택하지 않으면 전체</small>
                </legend>
                <div className="slideshow-chips">
                  {Object.entries(PHOTO_CATEGORIES).map(([value, label]) => {
                    const category = value as SlideshowSettings["categories"][number];
                    return (
                      <label key={value}>
                        <input
                          type="checkbox"
                          checked={draft.categories.includes(category)}
                          onChange={(e) =>
                            change({
                              categories: e.target.checked
                                ? [...draft.categories, category]
                                : draft.categories.filter((item) => item !== category)
                            })
                          }
                        />
                        {label}
                      </label>
                    );
                  })}
                </div>
                <p className="slideshow-help">
                  유형은 사진 상세 화면에서 직접 지정합니다. 여러 유형을 선택하면 해당 사진을 모두
                  포함합니다.
                </p>
              </fieldset>
              <div className="slideshow-timing">
                <label>
                  사진 표시 시간
                  <select
                    aria-label="사진 표시 시간"
                    value={draft.photoSeconds}
                    onChange={(e) => change({ photoSeconds: Number(e.target.value) })}
                  >
                    {[...new Set([2, 3, 5, 8, 10, 15, 30, draft.photoSeconds])]
                      .sort((a, b) => a - b)
                      .map((n) => (
                        <option key={n} value={n}>
                          {n}초
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  표지 표시 시간
                  <select
                    aria-label="표지 표시 시간"
                    value={draft.coverSeconds}
                    disabled={!draft.showCovers}
                    onChange={(e) => change({ coverSeconds: Number(e.target.value) })}
                  >
                    {[...new Set([2, 3, 5, 8, draft.coverSeconds])]
                      .sort((a, b) => a - b)
                      .map((n) => (
                        <option key={n} value={n}>
                          {n}초
                        </option>
                      ))}
                  </select>
                </label>
              </div>
              <label className="slideshow-check">
                <input
                  type="checkbox"
                  checked={draft.showCovers}
                  onChange={(e) => change({ showCovers: e.target.checked })}
                />
                Day별 표지 넣기
              </label>
              <label className="slideshow-check">
                <input
                  type="checkbox"
                  checked={draft.showCaptions}
                  onChange={(e) => change({ showCaptions: e.target.checked })}
                />
                사진 설명 표시 (파일명 · 촬영 시각)
              </label>
              <label className="slideshow-check">
                <input
                  type="checkbox"
                  checked={draft.loop}
                  onChange={(e) => change({ loop: e.target.checked })}
                />
                끝나면 처음부터 반복
              </label>
            </section>
            <section className="slideshow-days" aria-label="Day 선택">
              <h3>함께 볼 Day</h3>
              <div className="slideshow-day-actions">
                <button className="btn" type="button" onClick={() => change({ dayNumbers: null })}>
                  전체 Day
                </button>
                <button className="btn" type="button" onClick={() => change({ dayNumbers: [] })}>
                  모두 해제
                </button>
                {currentDay !== undefined && (
                  <button
                    className="btn"
                    type="button"
                    onClick={() => change({ dayNumbers: [currentDay] })}
                  >
                    현재 Day만
                  </button>
                )}
              </div>
              <div className="slideshow-day-list">
                {[...schedule]
                  .sort((a, b) => a.day - b.day)
                  .map((day) => (
                    <label key={day.day}>
                      <input
                        type="checkbox"
                        checked={draft.dayNumbers === null || draft.dayNumbers.includes(day.day)}
                        onChange={(e) => {
                          const existing = draft.dayNumbers ?? schedule.map((item) => item.day);
                          change({
                            dayNumbers: e.target.checked
                              ? [...existing, day.day]
                              : existing.filter((n) => n !== day.day)
                          });
                        }}
                      />
                      <span>
                        <strong>{dayLabel(day)}</strong>
                        <span>{day.displayTitle}</span>
                        <small>{day.date}</small>
                      </span>
                    </label>
                  ))}
              </div>
              {!schedule.length && <p>일정 CSV를 먼저 가져와 주세요.</p>}
              <p className="slideshow-help">
                조건에 맞는 사진이 없는 Day는 표지도 생략합니다. Day 미배정·누락·손상 사진은
                재생에서 제외합니다.
              </p>
            </section>
          </div>
          <footer className="slideshow-setup-footer">
            <div aria-live="polite">
              <strong>
                {plan.dayCount}개 Day · 사진 {plan.photoCount}장
              </strong>
              <span>
                표지 포함 {plan.slides.length}개 슬라이드 · 약 {durationLabel(plan.durationSeconds)}
              </span>
              {(plan.excludedUnavailable > 0 || plan.excludedUnassigned > 0) && (
                <small>
                  제외: 누락·손상 {plan.excludedUnavailable}장 / Day 미배정{" "}
                  {plan.excludedUnassigned}장
                </small>
              )}
              {!plan.photoCount && (
                <small>재생할 사진이 없습니다. 사진 범위·유형·Day 선택을 확인해 주세요.</small>
              )}
              <small>설정과 사진 유형은 프로젝트의 Save 버튼으로 저장합니다.</small>
            </div>
            <button
              type="button"
              className="btn btn-accent-filled"
              disabled={!plan.photoCount}
              onClick={start}
            >
              ▶ 자동 재생 시작
            </button>
          </footer>
        </div>
      )}
    </dialog>
  );
};

type ImageState = "ready" | "failed";

// Only the current original is mounted. Slow or unreadable images cannot stall playback.
const SlidePhoto = ({
  photo,
  onState
}: {
  photo: PhotoItem;
  onState: (state: ImageState) => void;
}) => {
  const [state, setState] = useState<"loading" | ImageState>("loading");
  const settled = useRef(false);
  const settle = useCallback(
    (result: ImageState) => {
      if (settled.current) return;
      settled.current = true;
      setState(result);
      onState(result);
    },
    [onState]
  );
  useEffect(() => {
    const timeout = window.setTimeout(() => settle("failed"), 12000);
    return () => window.clearTimeout(timeout);
  }, [settle]);
  return (
    <>
      {state !== "failed" && (
        <img
          className="slideshow-photo"
          src={createOriginalPhotoUrl(photo.originalPath)}
          alt={photo.fileName}
          onLoad={() => settle("ready")}
          onError={() => settle("failed")}
        />
      )}
      {state === "failed" && (
        <div className="slideshow-image-notice" role="status">
          사진을 읽을 수 없어 건너뜁니다.
          <br />
          {photo.fileName}
        </div>
      )}
    </>
  );
};

const SlideshowPlayer = ({
  slides,
  settings,
  projectName,
  onClose,
  onConfigure
}: {
  slides: SlideshowSlide[];
  settings: SlideshowSettings;
  projectName: string;
  onClose: () => void;
  onConfigure: () => void;
}) => {
  const fullscreenElement = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [visit, setVisit] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [finished, setFinished] = useState(false);
  const [imageState, setImageState] = useState<{ visit: number; state: ImageState }>();
  const [failed, setFailed] = useState<Set<string>>(() => new Set());
  const [fullscreen, setFullscreen] = useState(false);
  const [notice, setNotice] = useState("");
  const [seeking, setSeeking] = useState(false);
  const slide = slides[index];
  const noPlayablePhotos = slides.every(
    (item) => item.kind === "cover" || failed.has(item.photo.id)
  );

  const seekTo = (position: number) => {
    const nextIndex = Math.max(0, Math.min(slides.length - 1, position));
    if (nextIndex === index && !finished) return;
    const target = slides[nextIndex];
    // Allow a directly selected photo to be retried if an earlier read failed.
    if (target.kind === "photo" && failed.has(target.photo.id)) {
      setFailed((previous) => {
        const next = new Set(previous);
        next.delete(target.photo.id);
        return next;
      });
    }
    setIndex(nextIndex);
    setVisit((value) => value + 1);
    setFinished(false);
  };

  const navigate = useCallback(
    (direction: number) => {
      let candidate = index;
      for (let attempt = 0; attempt < slides.length; attempt++) {
        candidate += direction;
        if (candidate < 0 || candidate >= slides.length) {
          if (!settings.loop) {
            if (direction > 0) {
              setPlaying(false);
              setFinished(true);
            }
            return;
          }
          candidate = (candidate + slides.length) % slides.length;
        }
        const next = slides[candidate];
        if (next.kind === "photo" && failed.has(next.photo.id)) continue;
        setIndex(candidate);
        setVisit((value) => value + 1);
        setFinished(false);
        return;
      }
      setPlaying(false);
      setFinished(true);
    },
    [failed, index, settings.loop, slides]
  );

  const onImageState = useCallback(
    (state: ImageState) => {
      setImageState({ visit, state });
      if (state === "failed" && slide.kind === "photo") {
        setFailed((previous) => new Set(previous).add(slide.photo.id));
      }
    },
    [slide, visit]
  );

  useEffect(() => {
    if (noPlayablePhotos) {
      setPlaying(false);
      setFinished(true);
      return;
    }
    if (seeking || !playing || (slide.kind === "photo" && imageState?.visit !== visit)) return;
    const delay =
      slide.kind === "cover"
        ? settings.coverSeconds * 1000
        : imageState?.state === "failed"
          ? 800
          : settings.photoSeconds * 1000;
    const timer = window.setTimeout(() => navigate(1), delay);
    return () => window.clearTimeout(timer);
  }, [imageState, navigate, noPlayablePhotos, playing, seeking, settings, slide, visit]);

  const togglePlayback = useCallback(() => {
    if (finished) {
      setIndex(0);
      setVisit((value) => value + 1);
      setFailed(new Set());
      setFinished(false);
      setPlaying(true);
    } else setPlaying((value) => !value);
  }, [finished]);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await fullscreenElement.current?.requestFullscreen();
      setNotice("");
    } catch {
      setNotice("전체 화면을 열 수 없습니다. 현재 창에서 재생을 계속합니다.");
    }
  }, [fullscreenElement]);

  useEffect(() => {
    const update = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLSelectElement ||
        (event.target instanceof HTMLInputElement &&
          (event.target.type !== "range" ||
            [
              "ArrowLeft",
              "ArrowRight",
              "ArrowUp",
              "ArrowDown",
              "Home",
              "End",
              "PageUp",
              "PageDown"
            ].includes(event.key))) ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      )
        return;
      if (event.code === "Space") {
        event.preventDefault();
        togglePlayback();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        navigate(1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        navigate(-1);
      } else if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        void toggleFullscreen();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [navigate, toggleFullscreen, togglePlayback]);

  return (
    <div className="slideshow-player" ref={fullscreenElement}>
      <header className="slideshow-player-header">
        <span>{projectName}</span>
        <div>
          <button type="button" onClick={onConfigure}>
            구성 변경
          </button>
          <button type="button" onClick={() => void toggleFullscreen()}>
            {fullscreen ? "전체 화면 해제" : "전체 화면"}
          </button>
          <button type="button" onClick={onClose} aria-label="슬라이드쇼 닫기">
            닫기 ✕
          </button>
        </div>
      </header>
      <div className="slideshow-stage" key={visit}>
        {slide.kind === "cover" ? (
          <article className="slideshow-cover">
            <span className="slideshow-eyebrow">
              {slide.day.dayType === "rest" ? "A DAY TO REST" : "THE CAMINO JOURNAL"}
            </span>
            <div className="slideshow-cover-day">{dayLabel(slide.day)}</div>
            <h2>{slide.day.displayTitle}</h2>
            {slide.day.viaPlaces.length > 0 && (
              <p className="slideshow-via">경유 · {slide.day.viaPlaces.join(" → ")}</p>
            )}
            <div className="slideshow-cover-meta">
              <span>{slide.day.date}</span>
              {slide.day.distanceKm !== undefined && <span>{slide.day.distanceKm} km</span>}
              <span>{slide.photoCount}장의 기억</span>
            </div>
            {slide.day.accommodation && (
              <p className="slideshow-accommodation">{slide.day.accommodation}</p>
            )}
          </article>
        ) : (
          <SlidePhoto photo={slide.photo} onState={onImageState} />
        )}
        {finished && (
          <div className="slideshow-end" role="status">
            <h2>
              {noPlayablePhotos
                ? "재생할 수 있는 사진이 없습니다"
                : "순례의 기억을 모두 보았습니다"}
            </h2>
            <p>
              {noPlayablePhotos
                ? "원본 파일의 위치와 상태를 확인해 주세요."
                : "다시 재생하거나 구성을 바꿔 새로운 흐름으로 감상하세요."}
            </p>
            <button type="button" onClick={togglePlayback}>
              처음부터 다시 재생
            </button>
          </div>
        )}
      </div>
      <footer className="slideshow-player-footer">
        <div className="slideshow-caption">
          <strong>
            {dayLabel(slide.day)} · {slide.day.displayTitle}
          </strong>
          {settings.showCaptions && slide.kind === "photo" && (
            <span>
              {slide.photo.fileName} ·{" "}
              {slideshowTimestamp(slide.photo)?.replace("T", " ") ?? "촬영 시각 없음"}
            </span>
          )}
        </div>
        <div className="slideshow-controls">
          <button
            type="button"
            disabled={index === 0 && !settings.loop}
            onClick={() => navigate(-1)}
            aria-label="이전 슬라이드"
          >
            ◀ 이전
          </button>
          <button type="button" className="slideshow-play-button" onClick={togglePlayback}>
            {finished ? "↺ 다시 재생" : playing ? "Ⅱ 일시정지" : "▶ 재생"}
          </button>
          <button
            type="button"
            disabled={finished}
            onClick={() => navigate(1)}
            aria-label="다음 슬라이드"
          >
            다음 ▶
          </button>
          <span className="slideshow-counter">
            {index + 1} / {slides.length}
          </span>
        </div>
        <input
          className="slideshow-seek"
          type="range"
          min={1}
          max={slides.length}
          step={1}
          value={index + 1}
          disabled={slides.length <= 1 || noPlayablePhotos}
          aria-label="슬라이드 이동"
          aria-valuetext={`${index + 1} / ${slides.length} · ${dayLabel(slide.day)} · ${slide.kind === "cover" ? "표지" : slide.photo.fileName}`}
          title="클릭하거나 드래그하여 슬라이드 이동"
          style={{
            backgroundImage: `linear-gradient(to right, #e4c49a ${slides.length > 1 ? (index / (slides.length - 1)) * 100 : 100}%, #46554c ${slides.length > 1 ? (index / (slides.length - 1)) * 100 : 100}%)`
          }}
          onChange={(event) => seekTo(Number(event.target.value) - 1)}
          onPointerDown={(event) => {
            setSeeking(true);
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerUp={() => setSeeking(false)}
          onPointerCancel={() => setSeeking(false)}
          onLostPointerCapture={() => setSeeking(false)}
          onBlur={() => setSeeking(false)}
        />
        <div className="slideshow-hints">
          <span>슬라이드바로 이동 · Space 재생/정지 · ← → 이동 · F 전체 화면 · Esc 닫기</span>
          <span>
            {settings.loop ? "반복 재생" : "한 번 재생"}
            {failed.size > 0 ? ` · 읽기 실패 ${failed.size}장` : ""}
          </span>
        </div>
        {notice && <p role="status">{notice}</p>}
      </footer>
    </div>
  );
};
