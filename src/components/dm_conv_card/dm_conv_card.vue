<template>
  <div class="dm-conv-card">
    <router-link
      :to="{ name: 'dm_conversation', params: {id: conversation.id }}"
    >
      <div class="heading">
        <div class="unread"
          v-if="conversation.unread"
        >
          <span
            class="badge badge-notification"
            role="figure"
            :title="$t('dm_conv.unread_msg')"
            :alt="$t('dm_conv.unread_msg')"
          >
            !
          </span>
          &nbsp;
        </div>
        <h4>{{ $t('dm_conv.default_name', {id: this.conversation.id}) }}</h4>
      </div>
      <div class="members">
        <UserAvatar
          v-for="user in membersTruncated.users"
          :user="user"
          :compact="true"
        />
        <div v-if="membersTruncated.truncated" class="ellipsis">
          ...
        </div>
      </div>
    </router-link>
    <div class="last-message">
      <div class="last-message-title">
        {{ $t('dm_conv.last_message_title') }}:
      </div>
      <Status
        :statusoid="conversation.last_status"
        :compact="true"
        :is-preview="true"
      />
    </div>
  </div>
</template>

<script src="./dm_conv_card.js"></script>

<style lang="scss">
@import '../../_variables.scss';

.dm-conv-card {
  .heading, .members {
    display: flex;
    flex-wrap: nowrap;
    overflow-x: hidden;
  }

  .members {
    padding: 6px 0;
  }

  .last-message-title {
    font-style: italic;
    color: var(--faint);
  }
}
</style>
