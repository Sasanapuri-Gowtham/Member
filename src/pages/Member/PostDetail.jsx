import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  Heart,
  MessageCircle,
  Share2,
  Trash2,
  Send,
  EyeOff,
  UserX,
  Loader2,
  MessageSquare,
  User,
} from "lucide-react";
import {
  getPostComments,
  addComment,
  togglePostLike,
  toggleCommentLike,
  deleteCommunityPost,
  getUserData,
  getCommunityPosts,
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

export default function PostDetail() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const userId =
    localStorage.getItem("userId") || "XixBCGGzCehNB1rZedd11TGWcRI2";

  const [post, setPost] = useState(location.state?.post || null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [isAnonComment, setIsAnonComment] = useState(false);
  const [sending, setSending] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [userName, setUserName] = useState("User");

  /* ── load post (if not passed via state) + comments ── */
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [userData, allComments] = await Promise.all([
        getUserData(userId),
        getPostComments(postId),
      ]);
      if (userData?.name) setUserName(userData.name);
      setComments(allComments);

      if (!post) {
        const allPosts = await getCommunityPosts();
        const found = allPosts.find((p) => p.postId === postId);
        if (found) setPost(found);
      }
    } catch (err) {
      console.error("Error loading post detail:", err);
    } finally {
      setLoading(false);
    }
  }, [postId, userId, post]);

  useEffect(() => {
    loadData();
  }, []);

  /* ── Post like ── */
  const handlePostLike = async () => {
    if (!post) return;
    const liked = (post.likedBy || []).includes(userId);
    setPost((p) => ({
      ...p,
      likedBy: liked
        ? p.likedBy.filter((id) => id !== userId)
        : [...(p.likedBy || []), userId],
    }));
    await togglePostLike(postId, userId);
  };

  /* ── Comment like ── */
  const handleCommentLike = async (commentId) => {
    setComments((prev) =>
      prev.map((c) => {
        if (c.commentId !== commentId) return c;
        const liked = (c.likedBy || []).includes(userId);
        return {
          ...c,
          likedBy: liked
            ? c.likedBy.filter((id) => id !== userId)
            : [...(c.likedBy || []), userId],
        };
      })
    );
    await toggleCommentLike(postId, commentId, userId);
  };

  /* ── Send comment ── */
  const handleSendComment = async () => {
    if (!commentText.trim() || sending) return;
    setSending(true);
    try {
      await addComment(postId, {
        authorId: userId,
        authorName: userName,
        body: commentText.trim(),
        isAnonymous: isAnonComment,
      });
      setCommentText("");
      const updated = await getPostComments(postId);
      setComments(updated);
      setPost((p) =>
        p ? { ...p, commentCount: (p.commentCount || 0) + 1 } : p
      );
    } catch (err) {
      console.error("Error adding comment:", err);
    } finally {
      setSending(false);
    }
  };

  /* ── Delete post ── */
  const handleDelete = async () => {
    try {
      await deleteCommunityPost(postId);
      navigate(-1);
    } catch (err) {
      console.error("Error deleting post:", err);
    }
  };

  /* ── Loading state ── */
  if (loading && !post) {
    return (
      <div className="post-detail-page">
        <div className="post-detail-appbar">
          <button className="create-post-back" onClick={() => navigate(-1)}>
            <ArrowLeft size={22} />
          </button>
          <h2>Discussion</h2>
          <div style={{ width: 36 }} />
        </div>
        <div className="community-loading">
          <Loader2 size={32} className="spin" style={{ color: "#00897b" }} />
        </div>
      </div>
    );
  }

  /* ── Post not found ── */
  if (!post) {
    return (
      <div className="post-detail-page">
        <div className="post-detail-appbar">
          <button className="create-post-back" onClick={() => navigate(-1)}>
            <ArrowLeft size={22} />
          </button>
          <h2>Discussion</h2>
          <div style={{ width: 36 }} />
        </div>
        <div className="community-empty">
          <h3>Post not found</h3>
        </div>
      </div>
    );
  }

  const isAuthor = post.authorId === userId;
  const isPostLiked = (post.likedBy || []).includes(userId);
  const displayName = post.isAnonymous
    ? "Anonymous"
    : post.authorName || "User";
  const initial = displayName[0]?.toUpperCase() || "?";

  return (
    <div className="post-detail-page">
      {/* ── Appbar ── */}
      <div className="post-detail-appbar">
        <button className="create-post-back" onClick={() => navigate(-1)}>
          <ArrowLeft size={22} />
        </button>
        <h2>Discussion</h2>
        {isAuthor ? (
          <button
            className="post-detail-delete"
            onClick={() => setShowDelete(true)}
          >
            <Trash2 size={20} />
          </button>
        ) : (
          <div style={{ width: 36 }} />
        )}
      </div>

      {/* ── Scrollable body ── */}
      <div className="post-detail-scroll">
        {/* ── Post Card ── */}
        <div className="post-detail-card">
          {/* Author row */}
          <div className="post-detail-author">
            <div
              className={`post-detail-avatar ${
                post.isAnonymous
                  ? "post-detail-avatar--anon"
                  : "post-detail-avatar--user"
              }`}
            >
              {post.isAnonymous ? <UserX size={20} /> : initial}
            </div>
            <div className="post-detail-author-info">
              <div className="post-detail-author-row">
                <span className="post-detail-author-name">{displayName}</span>
                {post.isAnonymous && (
                  <span className="post-detail-hidden-badge">
                    Hidden identity
                  </span>
                )}
              </div>
              <div className="post-detail-time">
                {formatTimeAgo(post.createdAt)}
              </div>
            </div>
          </div>

          {/* Title */}
          {post.title && <h2 className="post-detail-title">{post.title}</h2>}

          {/* Body */}
          {post.body && <p className="post-detail-text">{post.body}</p>}

          {/* Image */}
          {post.imageUrl && (
            <img
              src={post.imageUrl}
              alt=""
              className="post-detail-image"
              loading="lazy"
            />
          )}

          {/* Divider */}
          <div className="post-detail-divider" />

          {/* Actions */}
          <div className="post-detail-actions">
            <button
              className={`post-action-btn ${
                isPostLiked ? "post-action-btn--liked" : ""
              }`}
              onClick={handlePostLike}
            >
              <Heart size={17} />{" "}
              {(post.likedBy || []).length}{" "}
              <span className="action-label">Likes</span>
            </button>
            <button className="post-action-btn">
              <MessageCircle size={16} />{" "}
              {post.commentCount || 0}{" "}
              <span className="action-label">Comments</span>
            </button>
          </div>
        </div>

        {/* ── Comments Section Header ── */}
        <div className="comments-section-header">
          <div className="comments-bar" />
          <h3 className="comments-section-title">Comments</h3>
          <span className="comments-count-badge">
            {comments.length}
          </span>
        </div>

        {/* ── Comments List ── */}
        {loading ? (
          <div className="community-loading" style={{ padding: "20px 0" }}>
            <Loader2
              size={22}
              className="spin"
              style={{ color: "#00897b" }}
            />
          </div>
        ) : comments.length === 0 ? (
          <div className="comments-empty">
            <MessageSquare size={32} />
            <p>No comments yet. Be the first!</p>
          </div>
        ) : (
          comments.map((c) => {
            const cName = c.isAnonymous
              ? "Anonymous"
              : c.authorName || "User";
            const cInit = cName[0]?.toUpperCase() || "?";
            const cLiked = (c.likedBy || []).includes(userId);

            return (
              <div className="comment-card" key={c.commentId}>
                <div className="comment-header">
                  <div
                    className={`comment-avatar ${
                      c.isAnonymous
                        ? "comment-avatar--anon"
                        : "comment-avatar--user"
                    }`}
                  >
                    {c.isAnonymous ? <UserX size={12} /> : cInit}
                  </div>
                  <div className="comment-meta">
                    <span className="comment-name">{cName}</span>
                    <span className="comment-time">
                      {formatTimeAgo(c.createdAt)}
                    </span>
                  </div>
                  <button
                    className={`comment-like-btn ${
                      cLiked ? "comment-like-btn--liked" : ""
                    }`}
                    onClick={() => handleCommentLike(c.commentId)}
                  >
                    <Heart size={13} />{" "}
                    {(c.likedBy || []).length > 0
                      ? (c.likedBy || []).length
                      : ""}
                  </button>
                </div>
                <p className="comment-body">{c.body}</p>
              </div>
            );
          })
        )}
      </div>

      {/* ── Comment input bar ── */}
      <div className="comment-input-bar">
        <div className="comment-anon-row">
          <button
            className={`comment-anon-toggle ${
              isAnonComment ? "comment-anon-toggle--on" : ""
            }`}
            onClick={() => setIsAnonComment(!isAnonComment)}
          >
            {isAnonComment ? <UserX size={14} /> : <User size={14} />}
            <span>{isAnonComment ? "Anonymous" : "As yourself"}</span>
          </button>
        </div>
        <div className="comment-input-row">
          <input
            className="comment-input"
            placeholder="Write a comment..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendComment()}
          />
          <button
            className="comment-send-btn"
            disabled={!commentText.trim() || sending}
            onClick={handleSendComment}
          >
            {sending ? (
              <Loader2 size={16} className="spin" />
            ) : (
              <Send size={18} />
            )}
          </button>
        </div>
      </div>

      {/* ── Delete dialog ── */}
      {showDelete && (
        <div
          className="delete-overlay"
          onClick={() => setShowDelete(false)}
        >
          <div
            className="delete-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Delete Post</h3>
            <p>Are you sure you want to delete this post?</p>
            <div className="delete-dialog-actions">
              <button
                className="delete-dialog-cancel"
                onClick={() => setShowDelete(false)}
              >
                Cancel
              </button>
              <button
                className="delete-dialog-confirm"
                onClick={handleDelete}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
