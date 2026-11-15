import { Layout, LayoutContent, LayoutHeader, HStack, StackItem, VStack } from '@astryxdesign/core/Layout';
import { Heading, Text } from '@astryxdesign/core/Text';
import { useMediaQuery } from '@astryxdesign/core/hooks';

// Page frame shared by every view: heading row (title, detail, actions), then content.
// Actions sit beside the title on wide windows and wrap under it on narrow ones.
// AppShell owns the <main> landmark; views never render their own.
export function Page({ title, detail, actions, status, children, padding = 6, contentWidth }) {
  const isWide = useMediaQuery('(min-width: 1024px)');
  return <Layout height="auto" contentWidth={contentWidth}
    header={<LayoutHeader padding={padding} paddingBlockEnd={0}>
      <HStack gap={4} vAlign="start" wrap={isWide ? 'nowrap' : 'wrap'}>
        <StackItem size="fill">
          <VStack gap={1}>
            <Heading level={1}>{title}</Heading>
            {detail ? <Text type="supporting">{detail}</Text> : null}
            {status}
          </VStack>
        </StackItem>
        {actions ? <StackItem size="static">{actions}</StackItem> : null}
      </HStack>
    </LayoutHeader>}
    content={<LayoutContent padding={padding}>{children}</LayoutContent>} />;
}
