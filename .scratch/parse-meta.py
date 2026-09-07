import sys, json
d = json.load(sys.stdin)
edges = d.get('data', {}).get('objects', {}).get('edges', [])
ac = [e['node'] for e in edges if e['node'].get('namePlural') == 'agencyCampaigns']
if ac:
    node = ac[0]
    print('Object: %s / %s' % (node['nameSingular'], node['namePlural']))
    print('id: %s' % node['id'])
    print('isSystem: %s' % node['isSystem'])
    print('isActive: %s' % node['isActive'])
    print()
    print('Fields (%d total):' % len(node['fields']['edges']))
    for edge in node['fields']['edges']:
        f = edge['node']
        print('  %-30s type=%-15s isSystem=%-5s isNullable=%-5s' % (f['name'], f['type'], str(f['isSystem']), str(f['isNullable'])))
else:
    print('agencyCampaigns not found')
