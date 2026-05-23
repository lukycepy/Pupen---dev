import {
  Archive,
  BarChart3,
  BookOpen,
  Briefcase,
  Calendar,
  Clock,
  FileSearch,
  FileText,
  FolderKanban,
  Globe,
  HelpCircle,
  Image as ImageIcon,
  Mail,
  Inbox,
  Map as MapIcon,
  MessageSquare,
  Bot,
  QrCode,
  RefreshCcw,
  Server,
  ShieldCheck,
  Shield,
  Star,
  Tag,
  Users,
  UserPlus,
  Wallet,
  KeyRound,
  Link2,
  Siren,
  Wrench,
  Award,
  Webhook,
} from 'lucide-react';
import type { Dictionary } from '@/lib/dictionary-types';

export type AdminMenuItem = {
  id: string;
  label: string;
  icon: any;
  visible: boolean;
};

export type AdminMenuGroup = {
  title: string;
  items: AdminMenuItem[];
};

export function buildAdminMenuGroups(dict: Dictionary, permissions: any): AdminMenuGroup[] {
  const canView = (module: string) =>
    permissions.can_manage_admins || permissions[`can_view_${module}`] || permissions[`can_edit_${module}`];

  const canViewContent = canView('news') || canView('events') || canView('faq');
  const canViewFinance = canView('budget') || permissions.can_manage_admins;

  return [
    {
      title: dict.admin.navContent,
      items: [
        { id: 'events', label: dict.admin.tabEvents, icon: Calendar, visible: canView('events') },
        { id: 'blog', label: dict.admin.tabNews, icon: FileText, visible: canView('news') },
        { id: 'gallery', label: dict.admin.tabGallery, icon: ImageIcon, visible: canView('gallery') },
        { id: 'archive', label: dict.admin.tabArchive, icon: Archive, visible: canView('archive') },
        { id: 'banners', label: dict.admin.tabBanners, icon: Tag, visible: canView('banners') },
        { id: 'faq', label: dict.admin.tabFaq, icon: HelpCircle, visible: canView('faq') },
        { id: 'partners', label: dict.admin.tabPartners, icon: Users, visible: canView('partners') },
        { id: 'reviews', label: dict.admin.tabReviews, icon: Star, visible: canView('reviews') },
        { id: 'og_preview', label: dict.admin.tabOgPreview, icon: Globe, visible: canView('og_preview') },
      ],
    },
    {
      title: dict.admin.navStudents,
      items: [
        { id: 'books', label: dict.admin.tabBooks, icon: BookOpen, visible: canView('books') },
        { id: 'map', label: dict.admin.tabMap, icon: MapIcon, visible: canView('map') },
        { id: 'hunts', label: dict.admin.tabHunts, icon: MapIcon, visible: canView('hunts') },
        { id: 'discounts', label: dict.admin.tabDiscounts, icon: Tag, visible: canView('discounts') },
        { id: 'hours', label: dict.admin.tabHours, icon: Clock, visible: canView('hours') },
        { id: 'guide', label: dict.admin.tabGuide, icon: BookOpen, visible: canView('guide') },
        { id: 'schedule', label: dict.admin.tabSchedule, icon: Calendar, visible: canView('schedule') },
        { id: 'quizzes', label: dict.admin.tabQuizzes, icon: Briefcase, visible: canView('quizzes') },
        { id: 'jobs', label: dict.admin.tabJobs, icon: Briefcase, visible: canView('jobs') },
        { id: 'qr', label: dict.admin.tabQr, icon: QrCode, visible: canView('qr') },
      ],
    },
    {
      title: dict.admin.navCommunity,
      items: [
        { id: 'badges', label: dict.admin.tabBadges, icon: Award, visible: permissions.can_manage_admins },
        { id: 'messages', label: dict.admin.tabMessages, icon: MessageSquare, visible: canView('messages') },
        { id: 'trustbox', label: dict.admin.tabTrustbox, icon: Inbox, visible: permissions.can_manage_admins || permissions.trustbox_admin },
        { id: 'polls', label: dict.admin.tabPolls, icon: BarChart3, visible: canView('polls') },
        { id: 'feedback', label: dict.admin.tabFeedback, icon: MessageSquare, visible: canView('feedback') },
        { id: 'projects', label: dict.admin.tabProjects, icon: FolderKanban, visible: canView('projects') },
        { id: 'moderation', label: dict.admin.tabModeration, icon: Shield, visible: canView('moderation') },
      ],
    },
    {
      title: dict.admin.navOperations,
      items: [
        { id: 'content', label: dict.admin.tabContent, icon: FileText, visible: canViewContent },
        { id: 'apps', label: dict.admin.tabApplications, icon: UserPlus, visible: canView('apps') },
        { id: 'documents', label: dict.admin.tabDocuments, icon: FileText, visible: canView('documents') },
        { id: 'lost_found', label: dict.admin.tabLostFound, icon: KeyRound, visible: permissions.can_manage_admins },
        { id: 'sos', label: dict.admin.tabSos, icon: Siren, visible: permissions.can_manage_admins },
        { id: 'meetings', label: dict.admin.tabMeetings, icon: Users, visible: canView('meetings') },
        { id: 'governance', label: dict.admin.tabGovernance, icon: ShieldCheck, visible: canView('governance') },
        { id: 'assets', label: dict.admin.tabAssets, icon: ShieldCheck, visible: canView('assets') },
        { id: 'board', label: dict.admin.tabBoard, icon: Users, visible: permissions.can_manage_admins },
      ],
    },
    {
      title: dict.admin.navFinance,
      items: [
        { id: 'budget', label: dict.admin.tabBudget, icon: Wallet, visible: canView('budget') },
        { id: 'invoices', label: dict.admin.tabInvoices, icon: FileText, visible: canViewFinance },
        { id: 'billing', label: dict.admin.tabBilling, icon: FileText, visible: canViewFinance },
        { id: 'refunds', label: dict.admin.tabRefunds, icon: RefreshCcw, visible: canView('refunds') },
        { id: 'promo_rules', label: dict.admin.tabPromoRules, icon: Tag, visible: canView('events') },
        { id: 'tickets', label: dict.admin.tabTickets, icon: QrCode, visible: canView('events') },
        { id: 'ticket_security', label: dict.admin.tabTicketSecurity, icon: Shield, visible: canView('ticket_security') },
      ],
    },
    {
      title: dict.admin.navSystem,
      items: [
        { id: 'db_health', label: dict.admin.tabDbHealth, icon: Server, visible: permissions.can_manage_admins },
        { id: 'site_pages', label: dict.admin.tabSitePages, icon: Globe, visible: permissions.can_manage_admins || permissions.site_pages_any || canView('site_pages') },
        { id: 'broken_links', label: dict.admin.tabBrokenLinks, icon: Link2, visible: permissions.can_manage_admins },
        { id: 'webhooks', label: dict.admin.tabWebhooks, icon: Webhook, visible: permissions.can_manage_admins },
        { id: 'god_mode', label: dict.admin.tabMaintenance, icon: Wrench, visible: permissions.can_manage_admins },
        { id: 'analytics', label: dict.admin.tabAnalytics, icon: BarChart3, visible: canView('analytics') },
        { id: 'logs', label: dict.admin.tabLogs, icon: FileSearch, visible: canView('logs') },
        { id: 'newsletter', label: dict.admin.tabNewsletter, icon: Mail, visible: canView('newsletter') },
        { id: 'queue', label: dict.admin.tabEmailQueue, icon: Inbox, visible: permissions.can_manage_admins },
        { id: 'email_settings', label: dict.admin.tabEmailSettings, icon: Server, visible: canView('email_settings') },
        { id: 'email_templates', label: dict.admin.tabEmailTemplates, icon: Mail, visible: canView('email_settings') },
        { id: 'automation', label: dict.admin.tabAutomation, icon: Bot, visible: canView('email_settings') },
        { id: 'payment_settings', label: dict.admin.tabPaymentSettings, icon: Wallet, visible: permissions.can_manage_admins },
        { id: 'users', label: dict.admin.tabUsers, icon: Users, visible: permissions.can_manage_admins },
        { id: 'roles', label: dict.admin.tabRoles, icon: ShieldCheck, visible: permissions.can_manage_admins },
      ],
    },
  ];
}
