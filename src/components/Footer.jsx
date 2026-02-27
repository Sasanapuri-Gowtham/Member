import React from "react";
import { NavLink } from "react-router-dom";
import { Home, Pill, ClipboardList, User } from "lucide-react";

const tabs = [
  { id: "home", path: "/", label: "Home", icon: Home },
  { id: "meds", path: "/meds", label: "My Meds", icon: Pill },
  { id: "prescriptions", path: "/prescriptions", label: "Prescreps", icon: ClipboardList },
  { id: "profile", path: "/profile", label: "Profile", icon: User },
];

function Footer() {
  return (
    <nav className="bottom-nav">
      {tabs.map((tab) => {
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
    </nav>
  );
}

export default Footer;
