import { HStack, StackItem, VStack } from '@astryxdesign/core/Layout';
import { Divider } from '@astryxdesign/core/Divider';
import { Heading, Text } from '@astryxdesign/core/Text';
import { useMediaQuery } from '@astryxdesign/core/hooks';

// Label + description on the start side, controls on the end side; wraps under the label when narrow.
export function SettingRow({ title, description, children, details, isLast = false }) {
  const isNarrow = useMediaQuery('(max-width: 639px)');
  return <VStack gap={0}>
    <HStack gap={4} vAlign="center" wrap={isNarrow ? 'wrap' : 'nowrap'} paddingBlock={3}>
      <StackItem size="fill">
        <VStack gap={0.5}>
          <Text weight="medium">{title}</Text>
          {description ? <Text type="supporting">{description}</Text> : null}
        </VStack>
      </StackItem>
      {children ? <StackItem size="static"><HStack gap={2} vAlign="center" wrap={isNarrow ? 'wrap' : 'nowrap'}>{children}</HStack></StackItem> : null}
    </HStack>
    {details ? <VStack gap={3} paddingBlockEnd={3}>{details}</VStack> : null}
    {isLast ? null : <Divider />}
  </VStack>;
}

// A titled group of rows; the id lets the settings section list scroll to it.
export function SettingSection({ id, title, children }) {
  return <VStack as="section" gap={1} aria-labelledby={id}>
    <Heading level={2} id={id}>{title}</Heading>
    {children}
  </VStack>;
}
