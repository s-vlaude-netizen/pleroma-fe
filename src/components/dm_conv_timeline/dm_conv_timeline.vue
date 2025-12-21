<template>
  <Timeline
    title="$t('dm_conv.page_header')"
    :timeline="timeline"
    :conversation-id="conversationId"
    timeline-name="dmConv"
  >
    <template
      v-slot:extraHeading
    >
      <DMConvCard
        v-if="conversation"
        :conversation="conversation"
        :compact="false"
        :showFullControls="true"
        :showLastStatus="false"
        :linkToTimeline="false"
        @deleted="forceLeave"
      />
    </template>
  </Timeline>
</template>

<script src="./dm_conv_timeline.js"></script>
