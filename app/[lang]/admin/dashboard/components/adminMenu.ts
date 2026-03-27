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
  AlertTriangle,
} from 'lucide-react';

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

export function buildAdminMenuGroups(dict: any, permissions: any): AdminMenuGroup[] {
  const canView = (module: string) =>
    permissions.can_manage_admins || permissions[`can_view_${module}`] || permissions[`can_edit_${module}`];

  const canViewContent = canView('news') || canView('events') || canView('faq');
  const canViewFinance = canView('budget') || permissions.can_manage_admins;

  return [
    {
      title: 'Obsah',
      items: [
        { id: 'events', label: dict.admin.tabEvents, icon: Calendar, visible: canView('events') },
        { id: 'blog', label: dict.admin.tabNews, icon: FileText, visible: canView('news') },
        { id: 'gallery', label: dict.admin.tabGallery || 'Galerie', icon: ImageIcon, visible: canView('gallery') },
        { id: 'archive', label: dict.admin.tabArchive || 'Archiv', icon: Archive, visible: canView('archive') },
        { id: 'banners', label: dict.admin.tabBanners || 'Bannery', icon: Tag, visible: canView('banners') },
        { id: 'faq', label: dict.admin.tabFaq, icon: HelpCircle, visible: canView('faq') },
        { id: 'partners', label: dict.admin.tabPartners, icon: Users, visible: canView('partners') },
        { id: 'reviews', label: dict.admin.tabReviews || 'Recenze', icon: Star, visible: canView('reviews') },
        { id: 'og_preview', label: dict.admin?.tabOgPreview || 'OG Preview', icon: Globe, visible: canViewContent },
      ],
    },
    {
      title: 'Studenti',
      items: [
        { id: 'books', label: dict.admin.tabBooks || 'Burza', icon: BookOpen, visible: canView('books') },
        { id: 'map', label: dict.admin.tabMap || 'Mapa', icon: MapIcon, visible: canView('map') },
        { id: 'hunts', label: dict.admin.tabHunts || 'Bojovky', icon: MapIcon, visible: canView('hunts') },
        { id: 'discounts', label: dict.admin.tabDiscounts || 'Slevy', icon: Tag, visible: canView('discounts') },
        { id: 'hours', label: dict.admin.tabHours || 'Otevírací doby', icon: Clock, visible: canView('hours') },
        { id: 'guide', label: dict.admin.tabGuide || 'Průvodce', icon: BookOpen, visible: canView('guide') },
        { id: 'schedule', label: dict.admin.tabSchedule || 'Harmonogram', icon: Calendar, visible: canView('schedule') },
        { id: 'quizzes', label: dict.admin.tabQuizzes || 'Kvízy', icon: Briefcase, visible: canView('quizzes') },
        { id: 'jobs', label: dict.admin.tabJobs || 'Práce', icon: Briefcase, visible: canView('jobs') },
        { id: 'qr', label: dict.admin.tabQr || 'QR kódy', icon: QrCode, visible: canView('qr') },
      ],
    },
    {
      title: 'Komunita',
      items: [
        { id: 'badges', label: 'Odznaky (Gamifikace)', icon: Award, visible: permissions.can_manage_admins },
        { id: 'messages', label: dict.admin.tabMessages, icon: MessageSquare, visible: canView('messages') },
        { id: 'polls', label: dict.admin.tabPolls || 'Ankety', icon: BarChart3, visible: canView('polls') },
        { id: 'feedback', label: dict.admin.tabFeedback || 'Feedback', icon: MessageSquare, visible: canView('feedback') },
        { id: 'projects', label: dict.admin?.tabProjects || 'Projekty', icon: FolderKanban, visible: canView('logs') },
        { id: 'moderation', label: dict.admin?.tabModeration || 'Moderace', icon: Shield, visible: canView('logs') },
      ],
    },
    {
      title: 'Provoz',
      items: [
        { id: 'content', label: dict.admin?.tabContent || 'Knihovna obsahu', icon: FileText, visible: canViewContent },
        { id: 'apps', label: dict.admin.tabApplications || 'Přihlášky', icon: UserPlus, visible: canView('apps') },
        { id: 'documents', label: dict.admin.tabDocuments || 'Dokumenty', icon: FileText, visible: canView('documents') },
        { id: 'lost_found', label: 'Ztráty a nálezy', icon: KeyRound, visible: permissions.can_manage_admins },
        { id: 'sos', label: 'SOS kontakty', icon: Siren, visible: permissions.can_manage_admins },
        { id: 'meetings', label: dict.admin.tabMeetings || 'Schůze', icon: Users, visible: canView('meetings') },
        { id: 'governance', label: dict.admin?.tabGovernance || 'Governance', icon: ShieldCheck, visible: canView('meetings') },
        { id: 'assets', label: dict.admin.tabAssets || 'Majetek', icon: ShieldCheck, visible: canView('assets') },
        { id: 'board', label: dict.admin?.tabBoard || 'Vedení', icon: Users, visible: permissions.can_manage_admins },
      ],
    },
    {
      title: 'Finance',
      items: [
        { id: 'budget', label: dict.admin.tabBudget || 'Účetnictví', icon: Wallet, visible: canView('budget') },
        { id: 'invoices', label: dict.admin?.tabInvoices || 'Faktury', icon: FileText, visible: canViewFinance },
        { id: 'refunds', label: dict.admin?.tabRefunds || 'Refundy', icon: RefreshCcw, visible: canView('logs') },
        { id: 'promo_rules', label: dict.admin?.tabPromoRules || 'Promo kódy', icon: Tag, visible: canView('events') },
        { id: 'tickets', label: dict.admin.tabTickets || 'Vstupenky', icon: QrCode, visible: canView('events') },
        { id: 'ticket_security', label: dict.admin?.tabTicketSecurity || 'Anti-fraud', icon: Shield, visible: canView('logs') },
      ],
    },
    {
      title: 'Systém',
      items: [
        { id: 'site_pages', label: dict.admin?.tabSitePages || 'Stránky', icon: Globe, visible: permissions.can_manage_admins },
        { id: 'broken_links', label: 'Broken links', icon: Link2, visible: permissions.can_manage_admins },
        { id: 'webhooks', label: 'Webhooky', icon: Webhook, visible: permissions.can_manage_admins },
        { id: 'error_logs', label: 'Chyby (Logs)', icon: AlertTriangle, visible: permissions.can_manage_admins },
        { id: 'god_mode', label: 'God Mode', icon: Wrench, visible: permissions.can_manage_admins },
        { id: 'analytics', label: dict.admin.tabAnalytics || 'Analytika', icon: BarChart3, visible: canView('analytics') },
        { id: 'logs', label: dict.admin.tabLogs || 'Logy', icon: FileSearch, visible: canView('logs') },
        { id: 'newsletter', label: 'Newsletter', icon: Mail, visible: canView('newsletter') },
        { id: 'queue', label: 'E-mail fronta', icon: Inbox, visible: permissions.can_manage_admins },
        { id: 'email_settings', label: 'E-mail Nastavení', icon: Server, visible: canView('email_settings') },
        { id: 'email_templates', label: dict.admin?.tabEmailTemplates || 'E-mail šablony', icon: Mail, visible: canView('email_settings') },
        { id: 'automation', label: dict.admin?.tabAutomation || 'Automatizace', icon: Bot, visible: canView('email_settings') },
        { id: 'payment_settings', label: 'Platební nastavení', icon: Wallet, visible: permissions.can_manage_admins },
        { id: 'users', label: dict.admin.tabUsers || 'Uživatelé', icon: Users, visible: permissions.can_manage_admins },
        { id: 'roles', label: dict.admin?.tabRoles || 'Role', icon: ShieldCheck, visible: permissions.can_manage_admins },
      ],
    },
  ];
}
