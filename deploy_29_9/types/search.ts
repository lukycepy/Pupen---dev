export interface SearchPageResult {
  id: string;
  href: string;
  title: string;
}

export interface SearchEventResult {
  id: string;
  title: string;
  title_en?: string | null;
  date?: string | null;
  location?: string | null;
  image_url?: string | null;
  published_at?: string | null;
}

export interface SearchPostResult {
  id: string;
  title: string;
  title_en?: string | null;
  excerpt?: string | null;
  excerpt_en?: string | null;
  category?: string | null;
  image_url?: string | null;
  published_at?: string | null;
}

export interface SearchFaqResult {
  id: string;
  question: string;
  question_en?: string | null;
  answer?: string | null;
  answer_en?: string | null;
  category?: string | null;
  sort_order?: number | null;
  is_public?: boolean | null;
}

export interface SearchDiscountResult {
  id: string;
  title: string;
  category?: string | null;
  discount?: string | null;
  location_name?: string | null;
}

export interface SearchGuideResult {
  id: string;
  slug?: string | null;
  title: string;
  category?: string | null;
  excerpt?: string | null;
  content?: string | null;
  sort_order?: number | null;
}

export interface SearchArchiveResult {
  id: string;
  year?: number | null;
  title: string;
  title_en?: string | null;
  description?: string | null;
  description_en?: string | null;
}

export interface SearchResults {
  pages: SearchPageResult[];
  events: SearchEventResult[];
  posts: SearchPostResult[];
  faqs: SearchFaqResult[];
  books: [];
  discounts: SearchDiscountResult[];
  guide: SearchGuideResult[];
  archive: SearchArchiveResult[];
}

export interface SearchResponse {
  ok: boolean;
  results: SearchResults;
}

export interface NavbarUserProfile {
  email?: string | null;
  first_name?: string | null;
  is_admin?: boolean;
  is_member?: boolean;
  can_manage_admins?: boolean;
  can_view_member_portal?: boolean;
  can_edit_member_portal?: boolean;
}

export interface SitePageVisibilityConfig {
  enabled?: boolean;
  navbar?: boolean;
  tools?: boolean;
}
