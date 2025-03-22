export const settings = ({
  'project_name': 'Gateway',
  'author': 'Moniruzzaman Tuhin',
  'organization': 'Pico Technology',
  'version': '1.0',
});

export const storage = ({
  'server': '@auth/server',
  'token': '@auth/token',
  'queues': '@queues/sms',
  'sending_settings': '@settings/sending',
});

export const status=({
  'delivered':'delivered',
  'pending':'pending',
  'failed':'failed',
  'running':'running',
  'fetched':'fetched',
})
