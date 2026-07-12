const paths: Record<string, string[]> = {
  home: ["M3 10.5 12 3l9 7.5", "M5 10v10h5v-6h4v6h5V10"],
  edit_note: ["M4 6h10", "M4 10h8", "M4 14h6", "M15 16l4-4 2 2-4 4h-2v-2z"],
  image: ["M4 5h16v14H4z", "M7 15l3-3 2 2 3-4 4 5", "M8 9h.01"],
  brush: ["M14 4l6 6-8 8H6v-6l8-8z", "M4 20c2 0 3-1 3-3"],
  settings_input_component: ["M6 4v16", "M12 4v16", "M18 4v16", "M4 8h4", "M10 14h4", "M16 10h4"],
  hub: ["M12 12l5-5", "M12 12l-6 4", "M12 12l3 6", "M17 7h.01", "M6 16h.01", "M15 18h.01"],
  zoom_out_map: ["M4 9V4h5", "M20 9V4h-5", "M4 15v5h5", "M20 15v5h-5"],
  layers: ["M12 4l9 5-9 5-9-5 9-5z", "M3 14l9 5 9-5", "M3 18l9 5 9-5"],
  view_in_ar: ["M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z", "M12 12l8-4.5", "M12 12v9", "M12 12 4 7.5"],
  grid_view: ["M4 4h6v6H4z", "M14 4h6v6h-6z", "M4 14h6v6H4z", "M14 14h6v6h-6z"],
  settings: ["M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", "M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a7 7 0 0 0-1.7-1L14.5 3h-5l-.3 3.1a7 7 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.3 3.1h5l.3-3.1a7 7 0 0 0 1.7-1l2.4 1 2-3.4-2-1.5a7 7 0 0 0 .1-1z"],
  upload_file: ["M12 16V4", "M7 9l5-5 5 5", "M5 20h14"],
  gesture_select: ["M6 18h12", "M8 18V8a2 2 0 0 1 4 0v6", "M12 14v-3a2 2 0 0 1 4 0v5", "M16 16l3 3"],
  deployed_code: ["M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z", "M8 9.5l4 2.5 4-2.5", "M12 12v5"],
  bolt: ["M13 2 5 14h6l-1 8 8-12h-6l1-8z"],
  hourglass_top: ["M7 3h10", "M7 21h10", "M8 3c0 5 8 5 8 10s-8 5-8 10", "M16 3c0 5-8 5-8 10s8 5 8 10"],
  monitoring: ["M4 18l5-5 3 3 7-9", "M4 20h16", "M4 14v6"],
  gallery_thumbnail: ["M4 6h9v9H4z", "M15 8h5v5h-5z", "M15 15h5v3h-5z", "M7 12l2-2 2 3"],
  edit_square: ["M5 5h9", "M5 5v14h14v-9", "M10 14l8-8 2 2-8 8h-2v-2z"],
  auto_fix_high: ["M3 21l9-9", "M12 9l-1 4 4-1 3-6-6 3z", "M15 2l2 2", "M19 6l2 2"],
  image_search: ["M4 5h12v10H4z", "M7 12l2-2 2 2 2-3 3 4", "M17 17l4 4", "M17 20a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"],
  high_quality: ["M5 6h14v12H5z", "M8 15V9", "M8 12h3", "M11 15V9", "M14 15V9h3v6"],
  progress_activity: ["M12 3a9 9 0 1 0 9 9"],
  add: ["M12 5v14", "M5 12h14"],
  close: ["M6 6l12 12", "M18 6 6 18"],
  delete: ["M3 6h18", "M8 6V4h8v2", "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6", "M10 11v6", "M14 11v6"],
  casino: ["M5 5h14v14H5z", "M8 8h.01", "M12 12h.01", "M16 16h.01", "M16 8h.01", "M8 16h.01"],
  folder_open: ["M3 7h7l2 2h9v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z", "M3 11h18"],
  star: ["M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z"],
  star_outline: ["M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z"],
  check_box_outline_blank: ["M5 5h14v14H5z"],
  check_box: ["M5 5h14v14H5z", "M9 12l2 2 4-5"],
  default: ["M4 4h16v16H4z"]
};

export function Icon({
  name,
  className = "",
  title,
  filled = false
}: {
  name: string;
  className?: string;
  title?: string;
  filled?: boolean;
}) {
  const iconPaths = paths[name] ?? paths.default;
  const useFill = filled || name === "star";

  return (
    <svg
      aria-hidden={title ? undefined : true}
      className={`inline-block h-[1em] w-[1em] shrink-0 ${className}`}
      fill={useFill ? "currentColor" : "none"}
      role={title ? "img" : undefined}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      {title ? <title>{title}</title> : null}
      {iconPaths.map((path, index) => (
        <path d={path} key={`${name}-${index}`} />
      ))}
    </svg>
  );
}
