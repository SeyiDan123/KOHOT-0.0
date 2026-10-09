import React from 'react';
import { ProfileMenu, ProfileMenuProps } from './ProfileMenu';

export interface DashboardProfileMenuProps extends ProfileMenuProps {
  onGoToWebsite?: () => void;
}

export const DashboardProfileMenu: React.FC<DashboardProfileMenuProps> = (props) => {
  return <ProfileMenu {...props} />;
};
