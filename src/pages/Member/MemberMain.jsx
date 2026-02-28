import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import MemberHome from "./MemberHome";
import PrescriptionPage from "./PrescriptionPage";
import PrescriptionChat from "./PrescriptionChat";
import Profile from "./Profile";
import Community from "./Community";
import CreatePost from "./CreatePost";
import PostDetail from "./PostDetail";
import Footer from "../../components/Footer";
import "./Member.css";
import MyMedicines from "./MyMedicines";

function MemberMain() {
  const location = useLocation();
  const hideFooter =
    location.pathname === "/prescriptions/chat" ||
    location.pathname === "/community/create" ||
    location.pathname.startsWith("/community/post/");

  return (
    <div className="member-layout">
      <div className="member-page-content">
        <Routes>
          <Route path="/" element={<MemberHome />} />
          <Route path="/:userId" element={<MemberHome />} />
          <Route path="/meds" element={<MyMedicines />} />
          <Route path="/prescriptions" element={<PrescriptionPage />} />
          <Route path="/prescriptions/chat" element={<PrescriptionChat />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/community" element={<Community />} />
          <Route path="/community/create" element={<CreatePost />} />
          <Route path="/community/post/:postId" element={<PostDetail />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      {!hideFooter && <Footer />}
    </div>
  );
}

export default MemberMain;
