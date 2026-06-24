import { NavLink } from "react-router-dom";
import { Icon } from "./Icon";

const navItems = [
  { path: "/", label: "Home", icon: "home" },
  { path: "/txt2img", label: "Txt2Img", icon: "edit_note" },
  { path: "/img2img", label: "Img2Img", icon: "image" },
  { path: "/inpaint", label: "Inpaint", icon: "brush" },
  { path: "/controlnet", label: "ControlNet", icon: "settings_input_component" },
  { path: "/kontext", label: "Kontext", icon: "hub" },
  { path: "/upscaler", label: "Upscaler", icon: "zoom_out_map" },
  { path: "/depth-pro", label: "Depth Pro", icon: "layers" },
  { path: "/models", label: "Models", icon: "view_in_ar" },
  { path: "/gallery", label: "Gallery", icon: "grid_view" },
  { path: "/config", label: "Config", icon: "settings" }
];

export function NavRail({ className = "" }: { className?: string }) {
  return (
    <nav
      className={`titanium-rail fixed left-0 top-0 z-40 flex h-screen w-rail flex-col py-4 ${className}`}
    >
      <div className="mb-8 flex items-center justify-center">
        <div className="titanium-text flex h-10 w-10 items-center justify-center rounded-xl border border-metal-titanium-light/20 bg-[linear-gradient(180deg,rgba(18,40,74,0.96),rgba(9,22,44,0.96))] font-headline text-base font-semibold shadow-[inset_0_1px_0_rgba(243,247,251,0.18),0_0_14px_rgba(0,212,200,0.08)]">
          M
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === "/"}
            className={({ isActive }) =>
              [
                "group mx-2 flex flex-col items-center justify-center rounded-xl border px-2 py-3 transition duration-150",
                isActive
                  ? "nav-item-active border-secondary/30 text-white"
                  : "border border-transparent text-on-surface-variant/72 hover:border-outline/18 hover:bg-white/[0.03] hover:text-metal-titanium-light"
              ].join(" ")
            }
          >
            {({ isActive }) => (
              <>
                <Icon className="mb-1 text-[20px]" name={item.icon} />
                <span className="font-label text-[8px] tracking-[0.12em]">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
