import { BrowserRouter, Routes, Route } from "react-router-dom";
import Meetings from "./pages/Meetings";
import CreateMeeting from "./pages/CreateMeeting";
import MeetingDetail from "./pages/MeetingDetail";
import Inbox from "./pages/Inbox";
import AuditLogs from "./pages/AuditLogs";
import Navbar from "./components/Navbar";

function App() {
    return (
        <BrowserRouter>
            <Navbar />
            <Routes>
                <Route path="/" element={<Meetings />} />
                <Route path="/create" element={<CreateMeeting />} />
                <Route path="/meetings/:id" element={<MeetingDetail />} />
                <Route path="/inbox" element={<Inbox />} />
                <Route path="/audit" element={<AuditLogs />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;