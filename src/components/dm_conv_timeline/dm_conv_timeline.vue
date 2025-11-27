<template>
  <!--
    TODO: add conv details in header via slots
    https://vuejs.org/guide/components/slots.html#slots
  -->
  <Timeline
    title="$t('dm_conv.page_header')"
    :timeline="timeline"
    :conversation-id="conversationId"
    timeline-name="dmConv"
  />
</template>

<script src="./dm_conv_timeline.js"></script>
