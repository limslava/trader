import React from 'react';
import { Card, CardContent, CardProps, Grow, Slide, Fade } from '@mui/material';

interface AnimatedCardProps extends CardProps {
  animation?: 'grow' | 'slide' | 'fade';
  delay?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
}

const AnimatedCard: React.FC<AnimatedCardProps> = ({ 
  children,
  animation = 'grow',
  delay = 0,
  direction = 'up',
  ...props 
}) => {
  const animationProps = {
    in: true,
    timeout: 500,
    style: { transitionDelay: `${delay}ms` },
  };

  const renderAnimation = () => {
    switch (animation) {
      case 'slide':
        return (
          <Slide direction={direction} {...animationProps}>
            <Card {...props}>
              <CardContent>
                {children}
              </CardContent>
            </Card>
          </Slide>
        );
      case 'fade':
        return (
          <Fade {...animationProps}>
            <Card {...props}>
              <CardContent>
                {children}
              </CardContent>
            </Card>
          </Fade>
        );
      case 'grow':
      default:
        return (
          <Grow {...animationProps}>
            <Card {...props}>
              <CardContent>
                {children}
              </CardContent>
            </Card>
          </Grow>
        );
    }
  };

  return renderAnimation();
};

export default AnimatedCard;