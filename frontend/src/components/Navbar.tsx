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

    const isActive = (path: string) => {
        return location.pathname === path;
    };

    return (
        <nav style={{
            position: "sticky",
            top: 16,
            zIndex: 100,
            margin: "16px 24px 32px 24px",
            padding: "12px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--bg-secondary)",
            border: "1px solid var(--border-light)",
            borderRadius: "12px",
            boxShadow: "var(--card-shadow)",
            transition: "background-color var(--transition-normal), border var(--transition-normal)",
            flexWrap: "wrap",
            gap: "16px"
        }}>
            {/* Logo */}
            <Link to="/" style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                textDecoration: "none"
            }}>
                <div style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    background: "linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 0 10px var(--accent-glow)"
                }}>
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

            {/* Navigation Links */}
            <div style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                background: "var(--bg-tertiary)",
                padding: "4px",
                borderRadius: "10px",
                border: "1px solid var(--border-light)"
            }}>
                <Link to="/" style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 16px",
                    borderRadius: "6px",
                    color: isActive("/") ? "var(--text-primary)" : "var(--text-secondary)",
                    background: isActive("/") ? "var(--bg-secondary)" : "transparent",
                    border: isActive("/") ? "1px solid var(--border-light)" : "1px solid transparent",
                    textDecoration: "none",
                    fontSize: "14px",
                    fontWeight: 500,
                    transition: "all var(--transition-fast)",
                }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    Meetings
                </Link>

                <Link to="/inbox" style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 16px",
                    borderRadius: "6px",
                    color: isActive("/inbox") ? "var(--text-primary)" : "var(--text-secondary)",
                    background: isActive("/inbox") ? "var(--bg-secondary)" : "transparent",
                    border: isActive("/inbox") ? "1px solid var(--border-light)" : "1px solid transparent",
                    textDecoration: "none",
                    fontSize: "14px",
                    fontWeight: 500,
                    transition: "all var(--transition-fast)",
                }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                        <polyline points="22,6 12,13 2,6" />
                    </svg>
                    Inbox
                </Link>
                
                <Link to="/create" style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 16px",
                    borderRadius: "6px",
                    color: isActive("/create") ? "var(--text-primary)" : "var(--text-secondary)",
                    background: isActive("/create") ? "var(--bg-secondary)" : "transparent",
                    border: isActive("/create") ? "1px solid var(--border-light)" : "1px solid transparent",
                    textDecoration: "none",
                    fontSize: "14px",
                    fontWeight: 500,
                    transition: "all var(--transition-fast)",
                }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    New Meeting
                </Link>

                <Link to="/audit" style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 16px",
                    borderRadius: "6px",
                    color: isActive("/audit") ? "var(--text-primary)" : "var(--text-secondary)",
                    background: isActive("/audit") ? "var(--bg-secondary)" : "transparent",
                    border: isActive("/audit") ? "1px solid var(--border-light)" : "1px solid transparent",
                    textDecoration: "none",
                    fontSize: "14px",
                    fontWeight: 500,
                    transition: "all var(--transition-fast)",
                }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                    Audit Logs
                </Link>
            </div>

            {/* Controls Side */}
            <div style={{
                display: "flex",
                alignItems: "center",
                gap: "12px"
            }}>
                {/* Active User Switcher */}
                <select 
                    value={currentUser} 
                    onChange={e => handleUserChange(e.target.value)} 
                    style={{
                        background: "var(--bg-tertiary)",
                        color: "var(--text-primary)",
                        border: "1px solid var(--border-light)",
                        borderRadius: "8px",
                        padding: "6px 12px",
                        fontSize: "13px",
                        fontWeight: 600,
                        cursor: "pointer",
                        outline: "none"
                    }}
                >
                    {users.map(u => (
                        <option key={u.id} value={u.name}>{u.name}</option>
                    ))}
                    {users.length === 0 && (
                        <option value="Uday Kumar">Uday Kumar</option>
                    )}
                </select>

                {/* Notification Bell */}
                <NotificationBell currentUser={currentUser} />

                {/* Theme Toggle Button */}
                <button
                    onClick={toggleTheme}
                    style={{
                        background: "var(--bg-tertiary)",
                        border: "1px solid var(--border-light)",
                        borderRadius: "8px",
                        width: "36px",
                        height: "36px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--text-secondary)",
                        cursor: "pointer",
                        transition: "all var(--transition-fast)"
                    }}
                    title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
                >
                    {theme === "light" ? (
                        /* Moon Icon */
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                        </svg>
                    ) : (
                        /* Sun Icon */
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

                {/* System Status */}
                <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "6px 12px",
                    background: "rgba(16, 185, 129, 0.06)",
                    border: "1px solid rgba(16, 185, 129, 0.15)",
                    borderRadius: "20px",
                }}>
                    <span style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        backgroundColor: "#10b981",
                        display: "inline-block",
                        boxShadow: "0 0 8px #10b981",
                    }}></span>
                    <span style={{
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "#10b981",
                        fontFamily: "var(--font-heading)"
                    }}>Online</span>
                </div>
            </div>
        </nav>
    );
}