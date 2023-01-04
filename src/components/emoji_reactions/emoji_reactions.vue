<template>
  <div class="emoji-reactions">
    <UserListPopover
      v-for="(reaction) in emojiReactions"
      :key="reaction.url || reaction.name"
      :users="accountsForEmoji[reaction.url || reaction.name]"
    >
      <button
        class="emoji-reaction btn button-default"
        :class="{ 'picked-reaction': reactedWith(reaction.name), 'not-clickable': !loggedIn }"
        @click="emojiOnClick(reaction.name, $event)"
        @mouseenter="fetchEmojiReactionsByIfMissing()"
      >
        <template
          v-if="reaction.url !== null"
        >
          <StillImage
            :src="reaction.url"
            :title="reaction.name"
            :alt="reaction.name"
            class="reaction-emoji"
          />
          {{ reaction.count }}
        </template>
        <template v-else>
          <span class="reaction-emoji unicode-emoji">
            {{ reaction.name }}
          </span>
          <span>{{ reaction.count }}</span>
        </template>
      </button>
    </UserListPopover>
    <a
      v-if="tooManyReactions"
      class="emoji-reaction-expand faint"
      href="javascript:void(0)"
      @click="toggleShowAll"
    >
      {{ showAll ? $t('general.show_less') : showMoreString }}
    </a>
  </div>
</template>

<script src="./emoji_reactions.js"></script>
<style lang="scss">
@import '../../_variables.scss';

.emoji-reactions {
  display: flex;
  margin-top: 0.25em;
  flex-wrap: wrap;
  container-type: inline-size;
}

.emoji-reaction {
  padding: 2px 0.5em;
  margin-right: 0.5em;
  margin-top: 0.5em;
  display: flex;
  align-items: end;

  .reaction-emoji {
    width: auto;
    max-width: 96cqw;
    margin-right: 0.25em;
    image-rendering: pixelated;

    &.still-image {
      height: 2.55em;
    }
    &.unicode-emoji {
      display: inline-block;
      font-size: 2.125em; // assuming default line height of 1.2rem and emojis that don't exceed line height
      line-height: 2.55rem;
    }
  }
  &:focus {
    outline: none;
  }

  &.not-clickable {
    cursor: default;
    &:hover {
      box-shadow: $fallback--buttonShadow;
      box-shadow: var(--buttonShadow);
    }
  }
}

.emoji-reaction-expand {
  padding: 0 0.5em;
  margin-right: 0.5em;
  margin-top: 0.5em;
  display: flex;
  align-items: center;
  justify-content: center;
  &:hover {
    text-decoration: underline;
  }
}

.button-default.picked-reaction {
  &, &:hover {
    box-shadow: inset 0 0 0 1px var(--accent, $fallback--link);
  }
}

</style>
