<template>
  <button
    type="button"
    v-if="usePlaceholder"
    class="Attachment -placeholder button-default"
    :class="classNames"
    @click="openModal"
  >
    <a
      v-if="attachment.type !== 'html'"
      class="placeholder"
      target="_blank"
      :href="attachment.url"
      :alt="attachment.description"
      :title="attachment.description"
      @click.prevent
    >
      <FAIcon :icon="placeholderIconClass" />
      <b>{{ nsfw ? "NSFW / " : "" }}</b>{{ edit ? '' : placeholderName }}
    </a>
    <div
      v-if="edit || remove"
      class="attachment-buttons"
    >
      <button
        type="button"
        v-if="remove"
        class="button-default attachment-button -transparent"
        @click.prevent="onRemove"
      >
        <FAIcon icon="trash-alt" />
      </button>
    </div>
    <div
      v-if="size !== 'hide' && !hideDescription && edit"
      class="description-container"
      :class="{ '-static': !edit }"
    >
      <textarea
        v-model="localDescription"
        type="text"
        class="input description-field"
        :placeholder="$t('post_status.media_description')"
      />
    </div>
  </button>
  <div
    v-else
    class="Attachment"
    :class="classNames"
  >
    <div
      v-show="!isEmpty"
      class="attachment-wrapper"
    >
      <a
        v-if="hidden"
        class="image-container"
        :href="attachment.url"
        :alt="attachment.description"
        :title="attachment.description"
        @click.prevent.stop="toggleHidden"
      >
        <img
          :key="nsfwImage"
          class="nsfw"
          :src="nsfwImage"
        >
        <FAIcon
          v-if="attachment.type === 'video'"
          class="play-icon"
          icon="play-circle"
        />
      </a>
      <div
        v-if="!hidden"
        class="attachment-buttons"
      >
        <button
          v-if="attachment.type === 'flash' && flashLoaded"
          class="button-default attachment-button -transparent"
          :title="$t('status.attachment_stop_flash')"
          @click.prevent="stopFlash"
        >
          <FAIcon icon="stop" />
        </button>
        <Popover
          v-if="attachment.description && size !== 'small' && !edit && attachment.type !== 'unknown'"
          trigger="click"
          popover-class="popover popover-default description-popover"
          :trigger-attrs="{ 'class': 'button-default attachment-button -transparent', 'title': $t('status.attachment_description') }"
        >
          <template #trigger>
            <FAIcon icon="align-right" />
          </template>
          <template #content>
            <details open>
              <summary>{{ $t('status.attachment_description') }}</summary>
              <span>{{ localDescription }}</span>
            </details>
          </template>
        </Popover>
        <button
          type="button"
          v-if="!useModal && attachment.type !== 'unknown'"
          class="button-default attachment-button -transparent"
          :title="$t('status.show_attachment_in_modal')"
          @click.prevent="openModalForce"
        >
          <FAIcon icon="search-plus" />
        </button>
        <button
          type="button"
          v-if="nsfw && hideNsfwLocal"
          class="button-default attachment-button -transparent"
          :title="$t('status.hide_attachment')"
          @click.prevent="toggleHidden"
        >
          <FAIcon icon="times" />
        </button>
        <button
          type="button"
          v-if="shiftUp"
          class="button-default attachment-button -transparent"
          :title="$t('status.move_up')"
          @click.prevent="onShiftUp"
        >
          <FAIcon icon="chevron-left" />
        </button>
        <button
          type="button"
          v-if="shiftDn"
          class="button-default attachment-button -transparent"
          :title="$t('status.move_down')"
          @click.prevent="onShiftDn"
        >
          <FAIcon icon="chevron-right" />
        </button>
        <button
          type="button"
          v-if="remove"
          class="button-default attachment-button -transparent"
          :title="$t('status.remove_attachment')"
          @click.prevent="onRemove"
        >
          <FAIcon icon="trash-alt" />
        </button>
      </div>

      <a
        v-if="attachment.type === 'image' && (!hidden || preloadImage)"
        class="image-container"
        :class="{'-hidden': hidden && preloadImage }"
        :href="attachment.url"
        target="_blank"
        @click.stop.prevent="openModal"
      >
        <StillImage
          class="image"
          :referrerpolicy="referrerpolicy"
          :mimetype="attachment.mimetype"
          :src="attachment.large_thumb_url || attachment.url"
          :image-load-handler="onImageLoad"
          :alt="attachment.description"
        />
      </a>

      <a
        v-if="attachment.type === 'unknown' && !hidden"
        class="placeholder-container"
        :href="attachment.url"
        target="_blank"
      >
        <FAIcon
          :size="compact ? '2x' : '5x'"
          :icon="placeholderIconClass"
          :title="localDescription"
        />
        <p v-if="!compact">
          {{ localDescription }}
        </p>
      </a>

      <component
        :is="videoTag"
        v-if="attachment.type === 'video' && !hidden"
        class="video-container"
        :href="attachment.url"
        @click.stop.prevent="openModal"
      >
        <VideoAttachment
          class="video"
          :attachment="attachment"
          :controls="!useModal"
          @play="$emit('play')"
          @pause="$emit('pause')"
        />
        <FAIcon
          v-if="useModal"
          class="play-icon"
          icon="play-circle"
        />
      </component>

      <span
        v-if="attachment.type === 'audio' && !hidden"
        class="audio-container"
        :href="attachment.url"
        @click.stop.prevent="openModal"
      >
        <audio
          v-if="attachment.type === 'audio'"
          :src="attachment.url"
          :alt="attachment.description"
          :title="attachment.description"
          controls
          @play="$emit('play')"
          @pause="$emit('pause')"
        />
      </span>

      <div
        v-if="attachment.type === 'html' && attachment.oembed"
        class="oembed-container"
        @click.prevent="linkClicked"
      >
        <div
          v-if="attachment.thumb_url"
          class="image"
        >
          <img :src="attachment.thumb_url">
        </div>
        <div class="text">
          <!-- eslint-disable vue/no-v-html -->
          <h1><a :href="attachment.url">{{ attachment.oembed.title }}</a></h1>
          <div v-html="attachment.oembed.oembedHTML" />
          <!-- eslint-enable vue/no-v-html -->
        </div>
      </div>

      <span
        v-if="attachment.type === 'flash' && !hidden"
        class="flash-container"
        :href="attachment.url"
        @click.stop.prevent="openModal"
      >
        <Flash
          ref="flash"
          class="flash"
          :src="attachment.large_thumb_url || attachment.url"
          @player-opened="setFlashLoaded(true)"
          @player-closed="setFlashLoaded(false)"
        />
      </span>
    </div>
    <div
      v-if="size !== 'hide' && !hideDescription && edit"
      class="description-container"
      :class="{ '-static': !edit }"
    >
      <textarea
        v-model="localDescription"
        type="text"
        class="input description-field"
        :placeholder="$t('post_status.media_description')"
      />
    </div>
  </div>
</template>

<script src="./attachment.js"></script>

<style src="./attachment.scss" lang="scss"></style>
