import { createElement } from "react";

import { categoryIcon } from "./category-icons";
import { iconProps, type IconSize } from "./sizes";

interface CategoryIconProps {
  icon: string | null | undefined;
  size?: IconSize;
  className?: string;
}

export function CategoryIcon({ icon, size = "md", className }: CategoryIconProps) {
  return createElement(categoryIcon(icon), { ...iconProps(size), className });
}
