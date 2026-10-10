import React from "react";

interface RunningTruckIconProps {
  className?: string;
  size?: number;
}

export const RunningTruckIcon: React.FC<RunningTruckIconProps> = ({
  className = "",
  size = 22,
}) => {
  return (
    <img
      src="/2769339.png"
      alt="Delivery truck"
      width={size}
      height={size}
      className={`object-contain select-none pointer-events-none ${className}`}
    />
  );
};

export default RunningTruckIcon;

