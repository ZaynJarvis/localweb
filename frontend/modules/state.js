export const state = {
  apis: [],
  current: null,
  runs: [],
  // Posts
  posts: [],
  currentPost: null,
  activeView: 'apis',
  postsSubView: 'list', // 'list', 'settings', 'gallery'
  // Settings
  postsSettings: {},
  // Showcase
  showcaseUrl: null,
  showcaseLiked: false,
  showcasePromptUsed: null,
};

export function saveSelected(id) { localStorage.setItem('selected_api', id); }
export function loadSelected() { return localStorage.getItem('selected_api'); }
