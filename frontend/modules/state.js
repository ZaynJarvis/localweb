export const state = {
  apis: [],
  current: null,
  runs: [],
  // Posts
  posts: [],
  currentPost: null,
  activeView: 'apis',
  postsSubView: 'list', // 'list', 'settings', 'gallery'
  postsCardMode: 'full', // 'full' (with title/desc, 16:9) or 'compact' (image only, 1:1)
  // Settings
  postsSettings: {},
  // Showcase
  showcaseUrl: null,
  showcaseLiked: false,
  showcasePromptUsed: null,
};

export function saveSelected(id) { localStorage.setItem('selected_api', id); }
export function loadSelected() { return localStorage.getItem('selected_api'); }
