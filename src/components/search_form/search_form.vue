<template>
  <div class="SearchForm">
    <div
      v-if="showSyntaxHint"
      class="search-syntax-hint-box"
    >
      <p>{{ $t('search.search_hint_general') }}</p>
      <h3>{{ $t('search.syntax_hint_header') }}</h3>
      <h4>{{ $t('search.syntax_hint_db_name') }}</h4>
      <pre class="provider-description">{{ $t('search.syntax_hint_db_text') }}</pre>
      <h4>{{ $t('search.syntax_hint_meili_name') }}</h4>
      <pre class="provider-description">{{ $t('search.syntax_hint_meili_text') }}</pre>
      <h4>{{ $t('search.syntax_hint_elastic_name') }}</h4>
      <pre class="provider-description">{{ $t('search.syntax_hint_elastic_text') }}</pre>
    </div>
    <div class="setting-row">
      <button
        class="button-unstyled search-syntax-hint-button"
        :title="$t('search.syntax_hint_title')"
        @click.stop.prevent="toggleSyntaxHint"
      >
        <FAIcon
          class="icon"
          icon="circle-question"
        />
      </button>
      <input
        id="search-bar-input"
        ref="searchInput"
        v-model="searchTerm"
        class="search-bar-input"
        :placeholder="$t('nav.search')"
        type="text"
        @keyup.enter="find(searchTerm)"
      >
      <button
        class="button-default search-button"
        type="submit"
        @click="find(searchTerm)"
      >
        <FAIcon
          fixed-width
          icon="search"
        />
      </button>
    </div>
    <div class="setting-row">
      <div class="input-pair">
        <label for="search-type-input">
          {{ $t('search.form.type_filter_label') }}
        </label>
        <select
          id="search-type-input"
          ref="type"
          v-model="type"
        >
          <option value="statuses">
            {{ $t('search.form.type_statuses') }}
          </option>
          <option value="accounts">
            {{ $t('search.form.type_accounts') }}
          </option>
          <option value="hashtags">
            {{ $t('search.form.type_hashtags') }}
          </option>
          <option
            v-if="loggedIn"
            value=""
          >
            {{ $t('search.form.type_all') }}
          </option>
        </select>
      </div>
      <div
        class="input-pair"
        :class="{ 'disabled' : !loggedIn }"
      >
        <label for="search-resolve-input">
          {{ $t('search.form.resolve_setting_label') }}
        </label>
        <Checkbox
          id="search-resolve-input"
          v-model="resolve"
          :disabled="!loggedIn"
        />
      </div>
    </div>
    <div class="setting-row">
      <div
        class="input-pair"
        :class="{ 'disabled' : type && type !== 'statuses' }"
      >
        <label for="search-post-author-input">
          {{ $t('search.form.author_limit_label') }}
        </label>
        <EmojiInput
          v-model="author_nick"
          enable-emoji-picker
          hide-emoji-button
          :suggest="userSuggestor"
          class="search-post-author-emoji-input-wrapper"
        >
          <input
            id="search-post-author-input"
            v-model="author_nick"
            type="text"
            :disabled="(type && type !== 'statuses') || false"
            :placeholder="$t('search.form.author_limit_placeholder')"
          >
        </EmojiInput>
      </div>
      <div
        class="input-pair"
        :class="{ 'disabled' : (type && type !== 'accounts') || !loggedIn }"
      >
        <label for="search-user-following-input">
          {{ $t('search.form.following_limit_label') }}
        </label>
        <Checkbox
          id="search-user-following-input"
          v-model="following"
          :disabled="(type && type !== 'accounts') || !loggedIn"
        />
      </div>
    </div>
    <div
      class="alert error"
    >
      {{ errorMsg }}
    </div>
  </div>
</template>

<script src="./search_form.js"></script>

<style lang="scss">
@import '../../_variables.scss';

.SearchForm {
  display: flex;
  flex-direction: column;
  width: 100%;

  .setting-row {
    padding: 0.5em 0.5em;
    display: flex;
    flex-direction: row;
    align-items: baseline;
    vertical-align: baseline;
    justify-content: space-between;

    .input-pair {
      label {
        margin: 0em 0.5em 0em 0em;
      }

      &.disabled {
        color: var(--faint, $fallback--faint);
      }
    }

    .search-post-author-emoji-input-wrapper {
      display: inline-flex;
    }

    .search-bar-input,
    .search-button {
      height: 29px;
    }

    .search-bar-input {
      flex: 1 0 auto;
      margin-left: 0.5em;
    }
  }

  .search-syntax-hint-button {
    width: 1.7em;
    height: 1.7em;
    padding: 0 0.5em;
    display: inline-block;

    .icon {
      vertical-align: middle;
      height: inherit;
      width: inherit;
    }
  }

  .search-syntax-hint-box {
    margin: 0.5em 1em;
    padding: 0.5em;
    border: 1px solid var(--border, $fallback--border);
    border-radius: var(--tooltipRadius, $fallback--tooltipRadius);

    text-align: center;
    max-height: 220px;
    overflow-y: scroll;

    pre.provider-description {
      font-family: var(--interfaceFont, sans-serif);
      text-wrap-mode: wrap;
    }
  }
}

</style>
