import { NavLink } from "react-router-dom";

const navItems = [
  { path: "/", label: "HOME", icon: "home" },
  { path: "/txt2img", label: "TXT2IMG", icon: "edit_note" },
  { path: "/img2img", label: "IMG2IMG", icon: "image" },
  { path: "/inpaint", label: "INPAINT", icon: "brush" },
  { path: "/controlnet", label: "CONTROLNET", icon: "settings_input_component" },
  { path: "/kontext", label: "KONTEXT", icon: "hub" },
  { path: "/upscaler", label: "UPSCALER", icon: "zoom_out_map" },
  { path: "/depth-pro", label: "DEPTH PRO", icon: "layers" },
  { path: "/models", label: "MODELS", icon: "view_in_ar" },
  { path: "/gallery", label: "GALLERY", icon: "grid_view" },
  { path: "/config", label: "CONFIG", icon: "settings" }
];

export function NavRail({ className = "" }: { className?: string }) {
  return (
    <nav
      className={`scanline fixed left-0 top-0 z-40 flex h-screen w-rail flex-col border-r border-primary/30 bg-background py-4 ${className}`}
    >
      <div className="mb-8 flex items-center justify-center">
        <div className="font-headline text-xl font-bold text-primary neon-text-primary">M</div>
      </div>
      <div className="flex flex-1 flex-col gap-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === "/"}
            className={({ isActive }) =>
              [
                "group flex flex-col items-center justify-center py-3 transition duration-150",
                isActive
                  ? "scale-105 border-r-2 border-primary bg-primary/8 text-primary"
                  : "text-on-surface-variant/70 hover:bg-primary/8 hover:text-secondary"
              ].join(" ")
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className="material-symbols-outlined mb-1 text-[20px]"
                  style={{ fontVariationSettings: `'FILL' ${isActive ? 1 : 0}` }}
                >
                  {item.icon}
                </span>
                <span className="font-label text-[8px] tracking-[0.22em]">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
