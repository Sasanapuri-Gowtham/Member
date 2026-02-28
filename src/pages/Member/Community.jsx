import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Heart,
  MessageCircle,
  Share2,
  Loader2,
  MessageSquareText,
  UserX,
  EyeOff,
  Stethoscope,
  Brain,
  Apple,
  Activity,
  Pill,
  HeartPulse,
} from "lucide-react";
import {
  getCommunityPosts,
  togglePostLike,
  getUserData,
} from "../../services/firebase";
import "./Community.css";

/* ── helpers ── */
function formatTimeAgo(date) {
  if (!date) return "just now";
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/* ══════════════════════════════════════════
   Post Card (reusable)
   ══════════════════════════════════════════ */
export function PostCard({ post, currentUserId, onTap, onLike }) {
  const isLiked = (post.likedBy || []).includes(currentUserId);
  const displayName = post.isAnonymous ? "Anonymous" : post.authorName || "User";
  const initial = displayName[0]?.toUpperCase() || "?";

  return (
    <div className="post-card" onClick={onTap}>
      {/* Header */}
      <div className="post-card-header">
        <div
          className={`post-avatar ${
            post.isAnonymous ? "post-avatar--anon" : "post-avatar--user"
          }`}
        >
          {post.isAnonymous ? <UserX size={16} /> : initial}
        </div>
        <div className="post-author-info">
          <div className="post-author-name">{displayName}</div>
          <div className="post-time">{formatTimeAgo(post.createdAt)}</div>
        </div>
        {post.isAnonymous && (
          <span className="anon-badge">
            <EyeOff size={10} /> Anonymous
          </span>
        )}
      </div>

      {/* Title */}
      {post.title && <h3 className="post-title">{post.title}</h3>}

      {/* Body preview */}
      {post.body && <p className="post-body-preview">{post.body}</p>}

      {/* Image */}
      {post.imageUrl && (
        <img
          src={post.imageUrl}
          alt=""
          className="post-image"
          loading="lazy"
        />
      )}

      {/* Divider */}
      <div className="post-divider" />

      {/* Actions */}
      <div className="post-actions">
        <button
          className={`post-action-btn ${isLiked ? "post-action-btn--liked" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            onLike();
          }}
        >
          <Heart size={16} /> {(post.likedBy || []).length}
        </button>
        <button className="post-action-btn">
          <MessageCircle size={15} /> {post.commentCount || 0}
        </button>
        <div className="post-actions-spacer" />
        <button
          className="post-action-btn"
          onClick={(e) => e.stopPropagation()}
        >
          <Share2 size={14} />
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   Community Page (Feed + Groups tabs)
   ══════════════════════════════════════════ */
export default function Community() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("feed");
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  const userId =
    localStorage.getItem("userId") || "XixBCGGzCehNB1rZedd11TGWcRI2";

  /* ── Fetch user + posts ── */
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [userData, allPosts] = await Promise.all([
        getUserData(userId),
        getCommunityPosts(),
      ]);
      setCurrentUser(userData);
      setPosts(allPosts);
    } catch (err) {
      console.error("Error loading community:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleLike = async (postId) => {
    /* optimistic UI */
    setPosts((prev) =>
      prev.map((p) => {
        if (p.postId !== postId) return p;
        const liked = (p.likedBy || []).includes(userId);
        return {
          ...p,
          likedBy: liked
            ? p.likedBy.filter((id) => id !== userId)
            : [...(p.likedBy || []), userId],
        };
      })
    );
    try {
      await togglePostLike(postId, userId);
    } catch {
      loadData();
    }
  };

  return (
    <div
      className="member-page"
      style={{ display: "flex", flexDirection: "column" }}
    >
      {/* ── Header ── */}
      <div className="community-header">
        <div className="community-header-inner">
          <div className="community-header-top">
            <div className="community-header-text">
              <h1>Community</h1>
              <p>Discuss, share &amp; support each other</p>
            </div>
            <button
              className="community-add-btn"
              onClick={() => navigate("/community/create")}
            >
              <Plus size={20} />
            </button>
          </div>
          <div className="community-tabs">
            <button
              className={`community-tab ${
                activeTab === "feed" ? "community-tab--active" : ""
              }`}
              onClick={() => setActiveTab("feed")}
            >
              Feed
            </button>
            <button
              className={`community-tab ${
                activeTab === "groups" ? "community-tab--active" : ""
              }`}
              onClick={() => setActiveTab("groups")}
            >
              Groups
            </button>
          </div>
        </div>
      </div>

      {/* ── Feed Tab ── */}
      {activeTab === "feed" && (
        <>
          {loading ? (
            <div className="community-loading">
              <Loader2
                size={32}
                className="spin"
                style={{ color: "#00897b" }}
              />
            </div>
          ) : posts.length === 0 ? (
            <div className="community-empty">
              <div className="community-empty-icon">
                <MessageSquareText size={36} />
              </div>
              <h3>No posts yet</h3>
              <p>Be the first to start a discussion!</p>
            </div>
          ) : (
            <div className="community-feed">
              {posts.map((post) => (
                <PostCard
                  key={post.postId || post.id}
                  post={post}
                  currentUserId={userId}
                  onTap={() =>
                    navigate(`/community/post/${post.postId}`, {
                      state: { post },
                    })
                  }
                  onLike={() => handleLike(post.postId)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Groups Tab ── */}
      {activeTab === "groups" && (
        <div className="groups-grid">
          {[
            {
              icon: Stethoscope,
              name: "General Health",
              desc: "Discuss any health topic",
              members: 128,
              color: "#00897b",
              bg: "rgba(0,137,123,0.1)",
            },
            {
              icon: Brain,
              name: "Mental Wellness",
              desc: "Anxiety, stress & well-being",
              members: 94,
              color: "#7c3aed",
              bg: "rgba(124,58,237,0.1)",
            },
            {
              icon: Apple,
              name: "Nutrition & Diet",
              desc: "Healthy eating tips",
              members: 76,
              color: "#ea580c",
              bg: "rgba(234,88,12,0.1)",
            },
            {
              icon: Activity,
              name: "Fitness",
              desc: "Exercise & physical health",
              members: 112,
              color: "#2563eb",
              bg: "rgba(37,99,235,0.1)",
            },
            {
              icon: Pill,
              name: "Medications",
              desc: "Medicine questions & advice",
              members: 63,
              color: "#dc2626",
              bg: "rgba(220,38,38,0.1)",
            },
            {
              icon: HeartPulse,
              name: "Chronic Care",
              desc: "Long-term condition support",
              members: 45,
              color: "#db2777",
              bg: "rgba(219,39,119,0.1)",
            },
          ].map((g) => {
            const Icon = g.icon;
            return (
              <div className="group-card" key={g.name}>
                <div
                  className="group-card-icon"
                  style={{ background: g.bg }}
                >
                  <Icon size={24} style={{ color: g.color }} />
                </div>
                <div className="group-card-name">{g.name}</div>
                <div className="group-card-desc">{g.desc}</div>
                <div className="group-card-members">
                  {g.members} members
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
