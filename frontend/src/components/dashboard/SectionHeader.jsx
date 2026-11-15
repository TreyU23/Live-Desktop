import { HStack, StackItem } from '@astryxdesign/core/Layout';
import { Heading } from '@astryxdesign/core/Text';

// Overview section title with optional trailing content (a link-style button, a date).
export function SectionHeader({ id, title, children }) {
  return <HStack gap={3} vAlign="center" wrap="wrap">
    <StackItem size="fill"><Heading level={2} id={id}>{title}</Heading></StackItem>
    {children}
  </HStack>;
}
