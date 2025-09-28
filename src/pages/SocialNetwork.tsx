import React, { useState, useEffect } from 'react';
import { Heart, MessageCircle, Share2, Bookmark, MoreHorizontal, Plus, Image, Video, FileText, Users, TrendingUp } from 'lucide-react';
import { supabase } from '../supabase/config';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';

interface Post {
  id: string;
  content: string;
  image_url?: string;
  video_url?: string;
  user_id: string;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  created_at: string;
  user_profiles?: {
    full_name: string;
    avatar_url?: string;
  };
  is_liked?: boolean;
  is_bookmarked?: boolean;
}

interface Comment {
  id: string;
  content: string;
  user_id: string;
  post_id: string;
  created_at: string;
  user_profiles?: {
    full_name: string;
    avatar_url?: string;
  };
}

const SocialNetwork: React.FC = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPostContent, setNewPostContent] = useState('');
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [activeTab, setActiveTab] = useState<'feed' | 'trending' | 'following'>('feed');
  const { user } = useAuth();

  useEffect(() => {
    fetchPosts();
  }, [activeTab]);

  const fetchPosts = async () => {
    try {
      let query = supabase
        .from('social_posts')
        .select(`
          *,
          user_profiles!inner(full_name, avatar_url)
        `);

      if (activeTab === 'trending') {
        query = query.order('likes_count', { ascending: false });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      const { data, error } = await query.limit(20);

      if (error) throw error;

      // Check if user has liked/bookmarked posts
      if (user && data) {
        const postsWithInteractions = await Promise.all(
          data.map(async (post) => {
            const [likesResult, bookmarksResult] = await Promise.all([
              supabase
                .from('post_likes')
                .select('id')
                .eq('post_id', post.id)
                .eq('user_id', user.id)
                .single(),
              supabase
                .from('post_bookmarks')
                .select('id')
                .eq('post_id', post.id)
                .eq('user_id', user.id)
                .single()
            ]);

            return {
              ...post,
              is_liked: !likesResult.error,
              is_bookmarked: !bookmarksResult.error
            };
          })
        );
        setPosts(postsWithInteractions);
      } else {
        setPosts(data || []);
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
      toast.error('Failed to load posts');
    } finally {
      setLoading(false);
    }
  };

  const createPost = async () => {
    if (!user || !newPostContent.trim()) return;

    try {
      const { data, error } = await supabase
        .from('social_posts')
        .insert({
          content: newPostContent,
          user_id: user.id,
          likes_count: 0,
          comments_count: 0,
          shares_count: 0
        })
        .select(`
          *,
          user_profiles!inner(full_name, avatar_url)
        `)
        .single();

      if (error) throw error;

      setPosts([data, ...posts]);
      setNewPostContent('');
      setShowCreatePost(false);
      toast.success('Post created successfully!');
    } catch (error) {
      console.error('Error creating post:', error);
      toast.error('Failed to create post');
    }
  };

  const toggleLike = async (postId: string) => {
    if (!user) {
      toast.error('Please sign in to like posts');
      return;
    }

    try {
      const post = posts.find(p => p.id === postId);
      if (!post) return;

      if (post.is_liked) {
        // Unlike
        await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);

        await supabase
          .from('social_posts')
          .update({ likes_count: Math.max(0, post.likes_count - 1) })
          .eq('id', postId);

        setPosts(posts.map(p => p.id === postId ? {
          ...p,
          is_liked: false,
          likes_count: Math.max(0, p.likes_count - 1)
        } : p));
      } else {
        // Like
        await supabase
          .from('post_likes')
          .insert({ post_id: postId, user_id: user.id });

        await supabase
          .from('social_posts')
          .update({ likes_count: post.likes_count + 1 })
          .eq('id', postId);

        setPosts(posts.map(p => p.id === postId ? {
          ...p,
          is_liked: true,
          likes_count: p.likes_count + 1
        } : p));
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      toast.error('Failed to update like');
    }
  };

  const toggleBookmark = async (postId: string) => {
    if (!user) {
      toast.error('Please sign in to bookmark posts');
      return;
    }

    try {
      const post = posts.find(p => p.id === postId);
      if (!post) return;

      if (post.is_bookmarked) {
        await supabase
          .from('post_bookmarks')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);

        setPosts(posts.map(p => p.id === postId ? {
          ...p,
          is_bookmarked: false
        } : p));
        toast.success('Removed from bookmarks');
      } else {
        await supabase
          .from('post_bookmarks')
          .insert({ post_id: postId, user_id: user.id });

        setPosts(posts.map(p => p.id === postId ? {
          ...p,
          is_bookmarked: true
        } : p));
        toast.success('Added to bookmarks');
      }
    } catch (error) {
      console.error('Error toggling bookmark:', error);
      toast.error('Failed to update bookmark');
    }
  };

  const fetchComments = async (postId: string) => {
    try {
      const { data, error } = await supabase
        .from('post_comments')
        .select(`
          *,
          user_profiles!inner(full_name, avatar_url)
        `)
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setComments(data || []);
    } catch (error) {
      console.error('Error fetching comments:', error);
      toast.error('Failed to load comments');
    }
  };

  const addComment = async () => {
    if (!user || !newComment.trim() || !selectedPost) return;

    try {
      const { data, error } = await supabase
        .from('post_comments')
        .insert({
          content: newComment,
          post_id: selectedPost.id,
          user_id: user.id
        })
        .select(`
          *,
          user_profiles!inner(full_name, avatar_url)
        `)
        .single();

      if (error) throw error;

      setComments([...comments, data]);
      setNewComment('');

      // Update comments count
      await supabase
        .from('social_posts')
        .update({ comments_count: selectedPost.comments_count + 1 })
        .eq('id', selectedPost.id);

      setPosts(posts.map(p => p.id === selectedPost.id ? {
        ...p,
        comments_count: p.comments_count + 1
      } : p));

      toast.success('Comment added!');
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('Failed to add comment');
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading social feed...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Social Network</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Connect with fellow learners, share insights, and discover new perspectives
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex justify-center mb-8">
          <div className="bg-white rounded-lg p-1 shadow-sm">
            <button
              onClick={() => setActiveTab('feed')}
              className={`px-6 py-2 rounded-md transition-colors ${
                activeTab === 'feed'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-600 hover:text-purple-600'
              }`}
            >
              <Users className="h-4 w-4 inline mr-2" />
              Feed
            </button>
            <button
              onClick={() => setActiveTab('trending')}
              className={`px-6 py-2 rounded-md transition-colors ${
                activeTab === 'trending'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-600 hover:text-purple-600'
              }`}
            >
              <TrendingUp className="h-4 w-4 inline mr-2" />
              Trending
            </button>
          </div>
        </div>

        {/* Create Post */}
        {user && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            {!showCreatePost ? (
              <button
                onClick={() => setShowCreatePost(true)}
                className="w-full flex items-center gap-3 p-4 text-left text-gray-500 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                  <Plus className="h-5 w-5 text-purple-600" />
                </div>
                <span>What's on your mind?</span>
              </button>
            ) : (
              <div className="space-y-4">
                <textarea
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                  placeholder="Share your thoughts, insights, or questions..."
                  className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  rows={4}
                />
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <button className="p-2 text-gray-400 hover:text-purple-600 transition-colors">
                      <Image className="h-5 w-5" />
                    </button>
                    <button className="p-2 text-gray-400 hover:text-purple-600 transition-colors">
                      <Video className="h-5 w-5" />
                    </button>
                    <button className="p-2 text-gray-400 hover:text-purple-600 transition-colors">
                      <FileText className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setShowCreatePost(false);
                        setNewPostContent('');
                      }}
                      className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={createPost}
                      disabled={!newPostContent.trim()}
                      className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white rounded-lg transition-colors"
                    >
                      Post
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Posts Feed */}
        <div className="space-y-6">
          {posts.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <Users className="h-16 w-16 mx-auto" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No posts yet</h3>
              <p className="text-gray-600">Be the first to share something with the community!</p>
            </div>
          ) : (
            posts.map((post) => (
              <div key={post.id} className="bg-white rounded-xl shadow-lg overflow-hidden">
                {/* Post Header */}
                <div className="p-6 pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-purple-400 to-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                        {post.user_profiles?.avatar_url ? (
                          <img
                            src={post.user_profiles.avatar_url}
                            alt={post.user_profiles.full_name}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          post.user_profiles?.full_name?.charAt(0) || 'U'
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {post.user_profiles?.full_name || 'Anonymous User'}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {formatTimeAgo(post.created_at)}
                        </p>
                      </div>
                    </div>
                    <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                      <MoreHorizontal className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {/* Post Content */}
                <div className="px-6 pb-4">
                  <p className="text-gray-800 whitespace-pre-wrap">{post.content}</p>
                  {post.image_url && (
                    <img
                      src={post.image_url}
                      alt="Post image"
                      className="mt-4 rounded-lg max-w-full h-auto"
                    />
                  )}
                </div>

                {/* Post Actions */}
                <div className="px-6 py-4 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <button
                        onClick={() => toggleLike(post.id)}
                        className={`flex items-center gap-2 transition-colors ${
                          post.is_liked
                            ? 'text-red-500'
                            : 'text-gray-500 hover:text-red-500'
                        }`}
                      >
                        <Heart className={`h-5 w-5 ${post.is_liked ? 'fill-current' : ''}`} />
                        <span>{post.likes_count}</span>
                      </button>
                      <button
                        onClick={() => {
                          setSelectedPost(post);
                          fetchComments(post.id);
                        }}
                        className="flex items-center gap-2 text-gray-500 hover:text-blue-500 transition-colors"
                      >
                        <MessageCircle className="h-5 w-5" />
                        <span>{post.comments_count}</span>
                      </button>
                      <button className="flex items-center gap-2 text-gray-500 hover:text-green-500 transition-colors">
                        <Share2 className="h-5 w-5" />
                        <span>{post.shares_count}</span>
                      </button>
                    </div>
                    <button
                      onClick={() => toggleBookmark(post.id)}
                      className={`transition-colors ${
                        post.is_bookmarked
                          ? 'text-purple-500'
                          : 'text-gray-500 hover:text-purple-500'
                      }`}
                    >
                      <Bookmark className={`h-5 w-5 ${post.is_bookmarked ? 'fill-current' : ''}`} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Comments Modal */}
        {selectedPost && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
              {/* Modal Header */}
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Comments</h3>
                  <button
                    onClick={() => {
                      setSelectedPost(null);
                      setComments([]);
                    }}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    ×
                  </button>
                </div>
              </div>

              {/* Comments List */}
              <div className="p-6 max-h-96 overflow-y-auto">
                {comments.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No comments yet. Be the first to comment!</p>
                ) : (
                  <div className="space-y-4">
                    {comments.map((comment) => (
                      <div key={comment.id} className="flex gap-3">
                        <div className="w-8 h-8 bg-gradient-to-r from-purple-400 to-blue-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                          {comment.user_profiles?.avatar_url ? (
                            <img
                              src={comment.user_profiles.avatar_url}
                              alt={comment.user_profiles.full_name}
                              className="w-full h-full rounded-full object-cover"
                            />
                          ) : (
                            comment.user_profiles?.full_name?.charAt(0) || 'U'
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="bg-gray-100 rounded-lg p-3">
                            <h4 className="font-semibold text-sm text-gray-900 mb-1">
                              {comment.user_profiles?.full_name || 'Anonymous User'}
                            </h4>
                            <p className="text-gray-800 text-sm">{comment.content}</p>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {formatTimeAgo(comment.created_at)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add Comment */}
              {user && (
                <div className="p-6 border-t border-gray-200">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 bg-gradient-to-r from-purple-400 to-blue-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                      U
                    </div>
                    <div className="flex-1">
                      <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Write a comment..."
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                        rows={2}
                      />
                      <div className="flex justify-end mt-2">
                        <button
                          onClick={addComment}
                          disabled={!newComment.trim()}
                          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white rounded-lg transition-colors"
                        >
                          Comment
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SocialNetwork;