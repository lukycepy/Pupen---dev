import base from './en.json';
import adminDashboard from './en.admin-dashboard.json';
import memberComponents from './en.member-components.json';
import { deepMerge } from '@/lib/deep-merge';

export default deepMerge(deepMerge(base, adminDashboard), memberComponents);
