import { MailIcon } from 'lucide-react';
import {
  IntroItem,
  IntroItemContent,
  IntroItemIcon,
  IntroItemLink
} from './intro-item';

export function EmailItem({ email }: { email: string }) {
  return (
    <IntroItem>
      <IntroItemIcon>
        <MailIcon />
      </IntroItemIcon>
      <IntroItemContent>
        <IntroItemLink href={`mailto:${email}`}>{email}</IntroItemLink>
      </IntroItemContent>
    </IntroItem>
  );
}
