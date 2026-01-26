<template>
  <Timeline
    title="$t('dm_conv.page_header')"
    :timeline="timeline"
    :conversation-id="conversationId"
    timeline-name="dmConv"
  >
    <template
      #extraHeading
    >
      <DMConvCard
        v-if="conversation"
        :conversation="conversation"
        :compact="false"
        :show-full-controls="true"
        :show-last-status="false"
        :link-to-timeline="false"
        @deleted="forceLeave"
      />
    </template>
  </Timeline>
</template>

<script src="./dm_conv_timeline.js"></script>
