import { Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { usersApi } from "../api/axios";
import NotificationBell from "./NotificationBell";

export default function Navbar() {
    const location = useLocation();

    // Theme state management
    const [theme, setTheme] = useState<"light" | "dark">(() => {
        const storedTheme = localStorage.getItem("theme");
        if (storedTheme === "dark") return "dark";
        return "light";
    });

    // Global active user state management
    const [currentUser, setCurrentUser] = useState(() => {
        return localStorage.getItem("currentUser") || "Uday Kumar";
    });

    const [users, setUsers] = useState<any[]>([]);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    useEffect(() => {
        document.documentElement.setAttribute("data-theme", theme);
        localStorage.setItem("theme", theme);
    }, [theme]);

    // Fetch users on mount for the user selector dropdown
    useEffect(() => {
        usersApi.getAll()
            .then(res => setUsers(res.data))
            .catch(err => console.error("Failed to load users for Navbar selector:", err));
    }, []);

    const toggleTheme = () => {
        setTheme(prev => prev === "light" ? "dark" : "light");
    };

    const handleUserChange = (newUser: string) => {
        setCurrentUser(newUser);
        localStorage.setItem("currentUser", newUser);
        // Dispatch a custom event so other pages (like Inbox) know the user changed
        window.dispatchEvent(new Event("currentUserChanged"));
    };

    // Listen for changes from other pages (e.g. if changed in Inbox)
    useEffect(() => {
        const handleStorageChange = () => {
            const user = localStorage.getItem("currentUser") || "Uday Kumar";
            setCurrentUser(user);
        };
        window.addEventListener("currentUserChanged", handleStorageChange);
        return () => window.removeEventListener("currentUserChanged", handleStorageChange);
    }, []);

    useEffect(() => {
        setMobileMenuOpen(false);
    }, [location.pathname]);

    const isActive = (path: string) => {
        return location.pathname === path;
    };

    const navItems = [
        { to: "/", label: "Meetings", icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
        )},
        { to: "/inbox", label: "Inbox", icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
            </svg>
        )},
        { to: "/create", label: "New Meeting", icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
        )},
        { to: "/audit", label: "Audit Logs", icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
        )},
    ];

    return (
        <nav className="app-navbar">
            <div className="navbar-main-row">
                <Link to="/" className="logo-link">
                    <div className="logo-mark">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                        </svg>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                        <span className="gradient-text" style={{
                            fontFamily: "var(--font-heading)",
                            fontWeight: 800,
                            fontSize: "18px",
                            letterSpacing: "-0.5px",
                            lineHeight: "1"
                        }}>DeepFabric</span>
                        <span style={{
                            fontSize: "9px",
                            fontWeight: 600,
                            color: "var(--text-muted)",
                            textTransform: "uppercase",
                            letterSpacing: "1.5px",
                            marginTop: "2px"
                        }}>Meeting AI</span>
                    </div>
                </Link>

                <div className="navbar-actions">
                    <div className="desktop-controls">
                        <select
                            value={currentUser}
                            onChange={e => handleUserChange(e.target.value)}
                            className="user-select"
                        >
                            {users.map(u => (
                                <option key={u.id} value={u.name}>{u.name}</option>
                            ))}
                            {users.length === 0 && (
                                <option value="Uday Kumar">Uday Kumar</option>
                            )}
                        </select>

                        <NotificationBell currentUser={currentUser} />

                        <button
                            onClick={toggleTheme}
                            className="icon-button"
                            title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
                        >
                            {theme === "light" ? (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                                </svg>
                            ) : (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="5" />
                                    <line x1="12" y1="1" x2="12" y2="3" />
                                    <line x1="12" y1="21" x2="12" y2="23" />
                                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                                    <line x1="1" y1="12" x2="3" y2="12" />
                                    <line x1="21" y1="12" x2="23" y2="12" />
                                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                                </svg>
                            )}
                        </button>

                        <div className="status-badge">
                            <span className="status-dot"></span>
                            <span>Online</span>
                        </div>
                    </div>

                    <button
                        type="button"
                        className={`mobile-hamburger ${mobileMenuOpen ? "open" : ""}`}
                        onClick={() => setMobileMenuOpen((v) => !v)}
                        aria-label="Toggle navigation"
                        aria-expanded={mobileMenuOpen}
                    >
                        <span></span>
                        <span></span>
                        <span></span>
                    </button>
                </div>
            </div>

            <div className="desktop-nav-shell">
                <div className="nav-links">
                    {navItems.map((item) => {
                        const active = isActive(item.to);
                        return (
                            <Link key={item.to} to={item.to} className={`nav-link ${active ? "active" : ""}`}>
                                {item.icon}
                                <span>{item.label}</span>
                            </Link>
                        );
                    })}
                </div>
            </div>

            {mobileMenuOpen && (
                <div className="mobile-menu-panel">
                    <div className="mobile-nav-links">
                        {navItems.map((item) => {
                            const active = isActive(item.to);
                            return (
                                <Link key={item.to} to={item.to} className={`nav-link mobile-nav-link ${active ? "active" : ""}`}>
                                    {item.icon}
                                    <span>{item.label}</span>
                                </Link>
                            );
                        })}
                    </div>
                    <div className="mobile-controls">
                        <select
                            value={currentUser}
                            onChange={e => handleUserChange(e.target.value)}
                            className="user-select mobile-user-select"
                        >
                            {users.map(u => (
                                <option key={u.id} value={u.name}>{u.name}</option>
                            ))}
                            {users.length === 0 && (
                                <option value="Uday Kumar">Uday Kumar</option>
                            )}
                        </select>

                        <div className="mobile-toolbar">
                            <NotificationBell currentUser={currentUser} />
                            <button onClick={toggleTheme} className="icon-button">
                                {theme === "light" ? (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                                    </svg>
                                ) : (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="5" />
                                        <line x1="12" y1="1" x2="12" y2="3" />
                                        <line x1="12" y1="21" x2="12" y2="23" />
                                        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                                        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                                        <line x1="1" y1="12" x2="3" y2="12" />
                                        <line x1="21" y1="12" x2="23" y2="12" />
                                        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                                        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                                    </svg>
                                )}
                            </button>
                        </div>
                        <div className="status-badge">
                            <span className="status-dot"></span>
                            <span>Online</span>
                        </div>
                    </div>
                </div>
            )}
        </nav>
    );
}