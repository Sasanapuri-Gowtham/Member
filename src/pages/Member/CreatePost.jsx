import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, Loader2 } from "lucide-react";
import { createCommunityPost, getUserData } from "../../services/firebase";
import "./Community.css";

export default function CreatePost() {
  const navigate = useNavigate();
  const userId =
    localStorage.getItem("userId") || "XixBCGGzCehNB1rZedd11TGWcRI2";

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");
  const [userName, setUserName] = useState("User");

  useEffect(() => {
    getUserData(userId).then((u) => {
      if (u?.name) setUserName(u.name);
    });
  }, [userId]);

  const handlePost = async () => {
    if (!title.trim() && !body.trim()) {
      setError("Please add a title or body for your post.");
      return;
    }
    setError("");
    setPosting(true);
    try {
      await createCommunityPost({
        authorId: userId,
        authorName: userName,
        title: title.trim(),
        body: body.trim(),
        isAnonymous,
        imageUrl: null,
        groupId: null,
      });
      navigate(-1);
    } catch (err) {
      console.error("Error creating post:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setPosting(false);
    }
  };

  const canPost = (title.trim() || body.trim()) && !posting;

  return (
    <div className="create-post-page">
      {/* ── App bar ── */}
      <div className="create-post-appbar">
        <button className="create-post-back" onClick={() => navigate(-1)}>
          <ArrowLeft size={22} />
        </button>
        <h2>Create Post</h2>
        <button
          className="create-post-submit"
          disabled={!canPost}
          onClick={handlePost}
        >
          {posting ? <Loader2 size={16} className="spin" /> : "Post"}
        </button>
      </div>

      {/* ── Body ── */}
      <div className="create-post-body">
        {/* ── Anonymous toggle ── */}
        <div className="anon-toggle-card">
          <div
            className={`anon-toggle-icon ${
              isAnonymous ? "anon-toggle-icon--on" : "anon-toggle-icon--off"
            }`}
          >
            {isAnonymous ? <EyeOff size={18} /> : <Eye size={18} />}
          </div>
          <div className="anon-toggle-text">
            <strong>
              {isAnonymous ? "Posting anonymously" : "Posting as yourself"}
            </strong>
            <span>
              {isAnonymous
                ? "Your identity will be hidden"
                : "Others can see your name"}
            </span>
          </div>
          <button
            className={`anon-switch ${isAnonymous ? "anon-switch--on" : ""}`}
            onClick={() => setIsAnonymous(!isAnonymous)}
            type="button"
          >
            <div className="anon-switch-thumb" />
          </button>
        </div>

        {/* ── Error ── */}
        {error && <div className="create-post-error">{error}</div>}

        {/* ── Title ── */}
        <div>
          <label className="create-post-label">Title</label>
          <input
            className="create-post-input"
            placeholder="Give your post a title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
          />
        </div>

        {/* ── Body ── */}
        <div>
          <label className="create-post-label">Body</label>
          <textarea
            className="create-post-input"
            placeholder="What's on your mind?"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            style={{ minHeight: "180px" }}
          />
        </div>
      </div>
    </div>
  );
}
