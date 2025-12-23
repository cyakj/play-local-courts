import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ProfileLinkProps {
  userId: string;
  children: React.ReactNode;
  className?: string;
  showTooltip?: boolean;
}

/**
 * A clickable link to a user's profile with consistent styling.
 * Use this in transactional contexts (lesson requests, reviews, messages)
 * where the user's name is displayed and should be clickable.
 */
export const ProfileLink = ({ 
  userId, 
  children, 
  className,
  showTooltip = true 
}: ProfileLinkProps) => {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/profile/${userId}`);
  };

  const linkElement = (
    <span
      onClick={handleClick}
      className={cn(
        "cursor-pointer text-primary hover:underline transition-colors",
        "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded",
        "active:opacity-80",
        className
      )}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      {children}
    </span>
  );

  if (showTooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {linkElement}
          </TooltipTrigger>
          <TooltipContent>
            <p>View profile</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return linkElement;
};
