# Administrator and Manager permission matrix

Migration 016 defines granular permissions and server enforcement.

| Capability | Administrator | Manager limited |
|---|---:|---:|
| Read operational screens and reports | Yes | Yes |
| Direct stock entry/exit | Yes | Yes |
| Product/customer/supplier/document/payment writes | Yes | No |
| User administration | Yes, protected RPC | No |
| Settings/roles management | Yes | No |
| Migration execute or mode change | No | No |

Validated effective counts: Administrator 107; Manager 32. The Manager forbidden-permission probe returned an empty set.
