import base from './cs.json';
import adminDashboard from './cs.admin-dashboard.json';
import memberComponents from './cs.member-components.json';
import { deepMerge } from '@/lib/deep-merge';

export default deepMerge(deepMerge(base, adminDashboard), memberComponents);
