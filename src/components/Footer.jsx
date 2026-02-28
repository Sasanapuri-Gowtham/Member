import React from "react";
import { NavLink } from "react-router-dom";
import { Home, Pill, ClipboardList, Users, Stethoscope } from "lucide-react";

const leftTabs = [
  { id: "home", path: "/", label: "Home", icon: Home },
  { id: "meds", path: "/meds", label: "My Meds", icon: Pill },
];

const rightTabs = [
  { id: "prescriptions", path: "/prescriptions", label: "Prescreps", icon: ClipboardList },
  { id: "community", path: "/community", label: "Community", icon: Users },
];

function Footer() {
  return (
    <nav className="bottom-nav">
      {leftTabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <NavLink
            key={tab.id}
            to={tab.path}
            end={tab.path === "/"}
            className={({ isActive }) =>
              `bottom-nav-item ${isActive ? "bottom-nav-item--active" : ""}`
            }
          >
            <Icon size={22} />
            <span className="bottom-nav-label">{tab.label}</span>
          </NavLink>
        );
      })}

      {/* Center floating game button */}
      <NavLink
        to="/game"
        className={({ isActive }) =>
          `bottom-nav-center ${isActive ? "bottom-nav-center--active" : ""}`
        }
      >
        <div className="bottom-nav-center-btn">
          <Stethoscope size={26} />
        </div>
        <span className="bottom-nav-label">Coach</span>
      </NavLink>

      {rightTabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <NavLink
            key={tab.id}
            to={tab.path}
            className={({ isActive }) =>
              `bottom-nav-item ${isActive ? "bottom-nav-item--active" : ""}`
            }
          >
            <Icon size={22} />
            <span className="bottom-nav-label">{tab.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

export default Footer;
