import { createTestingPinia } from '@pinia/testing'
import { flushPromises, mount } from '@vue/test-utils'
import { setActivePinia } from 'pinia'
import { mountOpts } from 'test/fixtures/setup_test.js'
import { userEvent } from 'vitest/browser'

import PostStatusForm from 'src/components/post_status_form/post_status_form.vue'

import { useInstanceStore } from 'src/stores/instance.js'
import { useInstanceCapabilitiesStore } from 'src/stores/instance_capabilities.js'
import { useUsersStore } from 'src/stores/users.js'

// A form with everything in it that has a button or a single-line field:
// pressing Enter in a field makes the browser click the form's first submit
// button, so what that is matters
const mountFullForm = ({ postHandler, ...props } = {}) => {
  setActivePinia(createTestingPinia({ stubActions: false }))
  useUsersStore().currentUser = {
    id: 'me',
    default_scope: 'public',
    locked: false,
  }
  useInstanceCapabilitiesStore().pollsAvailable = true
  useInstanceCapabilitiesStore().quotingAvailable = true
  useInstanceStore().limits.pollLimits = {
    max_options: 4,
    max_option_chars: 100,
    min_expiration: 60,
    max_expiration: 86400,
  }

  // in the page itself: that is where focus and key presses are
  const container = document.createElement('div')
  document.body.append(container)
  const wrapper = mount(
    PostStatusForm,
    mountOpts({
      attachTo: container,
      props: {
        repliedStatus: {
          id: 'status',
          visibility: 'public',
          user: { id: 'user', screen_name: 'someone' },
        },
        postHandler,
        ...props,
      },
    }),
  )
  wrapper.vm.newStatus.poll = {
    options: ['one', 'two', 'three'],
    expiresIn: 3600,
    multiple: false,
  }
  wrapper.vm.newStatus.files = [
    {
      id: '1',
      url: '/image.png',
      mimetype: 'image/png',
      type: 'image',
      description: '',
    },
  ]
  wrapper.vm.newStatus.quote = { thread: false, id: null, url: '' }
  wrapper.vm.newStatus.spoilerText = 'a content warning'
  wrapper.container = container
  return wrapper
}

// The poll and quote forms are loaded lazily and the browser is busy with other
// tests too: what is looked at must be there
const untilLoaded = (wrapper) =>
  vi.waitFor(
    () => {
      expect(wrapper.find('.poll-form input.expiry-amount').exists()).to.equal(
        true,
      )
      expect(wrapper.find('.quote-form input').exists()).to.equal(true)
    },
    { timeout: 5000, interval: 50 },
  )

// A real key press goes to whatever has the focus of the browser, which is
// contended while other tests run. Try until it does arrive, and give back what
// the form made of it.
const pressEnterIn = async (element) => {
  let pressed = null
  const record = (event) => {
    pressed = event
  }
  document.addEventListener('keydown', record)
  try {
    await vi.waitFor(
      async () => {
        element.focus()
        await userEvent.keyboard('{Enter}')
        if (!pressed) throw new Error('The key press did not arrive')
      },
      { timeout: 5000, interval: 100 },
    )
  } finally {
    document.removeEventListener('keydown', record)
  }
  return pressed
}

describe('PostStatusForm buttons', () => {
  let wrapper

  afterEach(() => {
    // not unmounted: the devtools hook of the app does not like that in a
    // page of its own and reports errors after the test has passed
    wrapper?.container.remove()
    wrapper = null
  })

  it('has just the post button submitting the form', async () => {
    wrapper = mountFullForm()
    await untilLoaded(wrapper)

    const submitters = [
      ...wrapper.get('form').element.querySelectorAll('button'),
    ]
      // the property is what the browser goes by: submit unless set otherwise
      .filter((button) => button.type === 'submit')

    expect(submitters.map((button) => button.className)).to.deep.equal([
      'btn button-default post-button',
    ])
  })

  describe('pressing Enter in a single-line field', () => {
    it.each([
      ['the content warning', {}, 'input.form-post-subject'],
      ['the poll expiry', {}, 'input.expiry-amount'],
      ['the mentions line', { mentionsLine: true }, 'input.mentions-input'],
    ])('does nothing in %s', async (_, props, selector) => {
      const postHandler = vi.fn(() => Promise.resolve({}))
      wrapper = mountFullForm({ postHandler, ...props })
      await untilLoaded(wrapper)
      const before = JSON.stringify(wrapper.vm.newStatus)

      const pressed = await pressEnterIn(wrapper.get(selector).element)
      await flushPromises()

      // Enter did not go on to do what it does by default in a form...
      expect(pressed.defaultPrevented).to.equal(true)
      // ...so not posted, and none of the buttons around it (remove a poll
      // option, toggle the poll, pick a file...) was clicked in its place
      expect(postHandler).not.toHaveBeenCalled()
      expect(JSON.stringify(wrapper.vm.newStatus)).to.equal(before)
      expect(wrapper.vm.newStatus.poll.options).to.have.length(3)
      expect(wrapper.vm.newStatus.files).to.have.length(1)
    })
  })
})
