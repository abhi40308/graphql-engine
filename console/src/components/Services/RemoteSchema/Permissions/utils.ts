import {
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLSchema,
  parse,
  DocumentNode,
  ObjectFieldNode,
  FieldDefinitionNode,
  InputValueDefinitionNode,
  ArgumentNode,
  ObjectTypeDefinitionNode,
  GraphQLInputField,
  GraphQLList,
  GraphQLInputFieldMap,
  GraphQLFieldMap,
  ValueNode,
  GraphQLInputType,
} from 'graphql';
import {
  isJsonString,
  isEmpty,
  isArrayString,
} from '../../../Common/utils/jsUtils';
import {
  PermissionEdit,
  RemoteSchemaFields,
  FieldType,
  ArgTreeType,
  PermissionsType,
  CustomFieldType,
  ChildArgumentType,
} from './types';
import Migration from '../../../../utils/migration/Migration';

export const findRemoteSchemaPermission = (
  perms: PermissionsType[],
  role: string
) => {
  return perms.find(p => p.role === role);
};

export const getCreateRemoteSchemaPermissionQuery = (
  def: { role: string },
  remoteSchemaName: string,
  schemaDefinition: string
) => {
  return {
    type: 'add_remote_schema_permissions',
    args: {
      remote_schema: remoteSchemaName,
      role: def.role,
      definition: {
        schema: schemaDefinition,
      },
    },
  };
};

export const getDropRemoteSchemaPermissionQuery = (
  role: string,
  remoteSchemaName: string
) => {
  return {
    type: 'drop_remote_schema_permissions',
    args: {
      remote_schema: remoteSchemaName,
      role,
    },
  };
};

export const getRemoteSchemaPermissionQueries = (
  permissionEdit: PermissionEdit,
  allPermissions: PermissionsType[],
  remoteSchemaName: string,
  schemaDefinition: string
) => {
  const { role, newRole } = permissionEdit;

  const permRole = (newRole || role).trim();

  const existingPerm = findRemoteSchemaPermission(allPermissions, permRole);
  const migration = new Migration();

  if (newRole || (!newRole && !existingPerm)) {
    migration.add(
      getCreateRemoteSchemaPermissionQuery(
        {
          role: permRole,
        },
        remoteSchemaName,
        schemaDefinition
      ),
      getDropRemoteSchemaPermissionQuery(permRole, remoteSchemaName)
    );
  }

  if (existingPerm) {
    migration.add(
      getDropRemoteSchemaPermissionQuery(permRole, remoteSchemaName),
      getDropRemoteSchemaPermissionQuery(permRole, remoteSchemaName)
    );
    migration.add(
      getCreateRemoteSchemaPermissionQuery(
        { role: permRole },
        remoteSchemaName,
        schemaDefinition
      ),
      getCreateRemoteSchemaPermissionQuery(
        { role: permRole },
        remoteSchemaName,
        existingPerm.definition.schema
      )
    );
  }

  return {
    upQueries: migration.upMigration,
    downQueries: migration.downMigration,
  };
};

export const updateBulkSelect = (
  bulkSelect: string[],
  selectedRole: string,
  isAdd: boolean
) => {
  const bulkRes = isAdd
    ? [...bulkSelect, selectedRole]
    : bulkSelect.filter(e => e !== selectedRole);
  return bulkRes;
};

/**
 * Sets query_root and mutation_root in UI tree.
 * @param introspectionSchema Remote Schema introspection schema.
 * @param permissionsSchema Permissions coming from saved role.
 * @param typeS Type of args.
 * @returns Array of schema fields (query_root and mutation_root)
 */
export const getTree = (
  introspectionSchema: GraphQLSchema | null,
  permissionsSchema: GraphQLSchema | null,
  typeS: string
) => {
  const introspectionSchemaFields =
    typeS === 'QUERY'
      ? introspectionSchema!.getQueryType()?.getFields()
      : introspectionSchema!.getMutationType()?.getFields();

  let permissionsSchemaFields:
    | GraphQLFieldMap<any, any, Record<string, any>>
    | null
    | undefined = null;
  if (permissionsSchema !== null) {
    permissionsSchemaFields =
      typeS === 'QUERY'
        ? permissionsSchema!.getQueryType()?.getFields()
        : permissionsSchema!.getMutationType()?.getFields();
  }

  if (introspectionSchemaFields) {
    return Object.values(introspectionSchemaFields).map(
      ({ name, args: argArray, type, ...rest }: any) => {
        let checked = false;
        const args = argArray.reduce((p: ArgTreeType, c: FieldType) => {
          return { ...p, [c.name]: { ...c } };
        }, {});
        if (
          permissionsSchema !== null &&
          permissionsSchemaFields &&
          name in permissionsSchemaFields
        ) {
          checked = true;
        }
        return { name, checked, args, return: type.toString(), ...rest };
      }
    );
  }
  return [];
};

/**
 * Sets input types, object types, scalar types and enum types in UI tree.
 * @param introspectionSchema - Remote schema introspection schema.
 * @param permissionsSchema - Permissions coming from saved role.
 * @returns Array of all types
 */
export const getType = (
  introspectionSchema: GraphQLSchema | null,
  permissionsSchema: GraphQLSchema | null
) => {
  const introspectionSchemaFields = introspectionSchema!.getTypeMap();

  let permissionsSchemaFields: any = null;
  if (permissionsSchema !== null) {
    permissionsSchemaFields = permissionsSchema!.getTypeMap();
  }

  const types: RemoteSchemaFields[] = [];

  Object.entries(introspectionSchemaFields).forEach(([key, value]: any) => {
    if (
      !(
        value instanceof GraphQLObjectType ||
        value instanceof GraphQLInputObjectType ||
        value instanceof GraphQLEnumType ||
        value instanceof GraphQLScalarType
      )
    )
      return;

    const name = value.inspect();
    if (
      name === 'query_root' ||
      name === 'mutation_root' ||
      name === 'subscription_root'
    )
      return;
    if (name.startsWith('__')) return;

    const type: RemoteSchemaFields = {
      name: ``,
      typeName: ``,
      children: [],
    };
    type.typeName = name;

    if (value instanceof GraphQLEnumType) {
      type.name = `enum ${name}`;
      const values = value.getValues();
      const childArray: CustomFieldType[] = [];
      let checked = false;
      if (
        permissionsSchema !== null &&
        permissionsSchemaFields !== null &&
        key in permissionsSchemaFields
      )
        checked = true;
      values.forEach(val => {
        childArray.push({
          name: val.name,
          checked,
        });
      });
      type.children = childArray;
      types.push(type);
    } else if (value instanceof GraphQLScalarType) {
      type.name = `scalar ${name}`;
      let checked = false;
      if (
        permissionsSchema !== null &&
        permissionsSchemaFields !== null &&
        key in permissionsSchemaFields
      )
        checked = true;
      const childArray: CustomFieldType[] = [{ name: type.name, checked }];
      type.children = childArray;
      types.push(type);
    } else if (value instanceof GraphQLObjectType) {
      type.name = `type ${name}`;
    } else if (value instanceof GraphQLInputObjectType) {
      type.name = `input ${name}`;
    }

    if (
      value instanceof GraphQLObjectType ||
      value instanceof GraphQLInputObjectType
    ) {
      const childArray: CustomFieldType[] = [];
      const fieldVal = value.getFields();
      let permissionsFieldVal: GraphQLFieldMap<any, any, any> = {};
      let isFieldPresent = true;

      // Check if the type is present in the permission schema coming from user.
      if (permissionsSchema !== null && permissionsSchemaFields !== null) {
        if (key in permissionsSchemaFields) {
          permissionsFieldVal = permissionsSchemaFields[key].getFields();
        } else {
          isFieldPresent = false;
        }
      }

      // Checked is true when type is present and the fields are present in type
      Object.entries(fieldVal).forEach(([k, v]) => {
        let checked = false;
        if (
          permissionsSchema !== null &&
          isFieldPresent &&
          k in permissionsFieldVal
        ) {
          checked = true;
        }
        childArray.push({
          name: v.name,
          checked,
          return: v.type.toString(),
        });
      });

      type.children = childArray;
      types.push(type);
    }
  });
  return types;
};

// method that tells whether the field is nested or not, if nested it returns the children
export const getChildArguments = (v: GraphQLInputField): ChildArgumentType => {
  if (typeof v === 'string') return {}; // value field
  if (v?.type instanceof GraphQLInputObjectType && v?.type?.getFields)
    return {
      children: v?.type?.getFields(),
      path: 'type._fields',
      childrenType: v?.type,
    };

  // 1st order
  if (v?.type instanceof GraphQLNonNull || v?.type instanceof GraphQLList) {
    const children = getChildArguments({
      type: v?.type.ofType,
    } as GraphQLInputField).children;
    if (isEmpty(children)) return {};

    return {
      children,
      path: 'type.ofType',
      childrenType: v?.type?.ofType,
    };
  }

  return {};
};

const isList = (gqlArg: GraphQLInputField, value: string) =>
  gqlArg &&
  gqlArg.type instanceof GraphQLList &&
  typeof value === 'string' &&
  isArrayString(value) &&
  !value.startsWith('x-hasura');

// utility function for getSDLField
const serialiseArgs = (args: ArgTreeType, argDef: GraphQLInputField) => {
  let res = '{';
  const { children } = getChildArguments(argDef);
  Object.entries(args).forEach(([key, value]) => {
    if (isEmpty(value) || isEmpty(children)) {
      return;
    }
    const gqlArgs = children as GraphQLInputFieldMap;
    const gqlArg = gqlArgs[key];

    if (typeof value === 'string' || typeof value === 'number') {
      let val;

      const isEnum =
        gqlArg &&
        gqlArg.type instanceof GraphQLEnumType &&
        typeof value === 'string' &&
        !value.startsWith('x-hasura');

      switch (true) {
        case isEnum:
          val = `${key}:${value}`; // no double quotes
          break;
        case typeof value === 'number':
          val = `${key}: ${value} `;
          break;

        case typeof value === 'string' && isList(gqlArg, value):
          val = `${key}: ${value} `;
          break;

        default:
          val = `${key}:"${value}"`;
          break;
      }

      if (res === '{') {
        res = `${res} ${val}`;
      } else {
        res = `${res} , ${val}`;
      }
    } else if (value && typeof value === 'object') {
      if (children && typeof children === 'object' && gqlArg) {
        const valString = serialiseArgs(value, gqlArg);
        if (valString && res === '{') res = `${res} ${key}: ${valString}`;
        else if (valString) res = `${res} , ${key}: ${valString}`;
      }
    }
  });
  if (res === `{`) return; // dont return string when there is no value
  return `${res}}`;
};

const isEnumType = (type: GraphQLInputType): boolean => {
  if (type instanceof GraphQLList || type instanceof GraphQLNonNull)
    return isEnumType(type.ofType);
  else if (type instanceof GraphQLEnumType) return true;
  return false;
};

// Check if type belongs to default gql scalar types
const checkDefaultGQLScalarType = (typeName: string): boolean => {
  const gqlDefaultTypes = ['Boolean', 'Float', 'String', 'Int', 'ID'];
  if (gqlDefaultTypes.indexOf(typeName) > -1) return true;
  return false;
};

const checkEmptyType = (type: RemoteSchemaFields) => {
  const isChecked = (element: FieldType | CustomFieldType) => element.checked;
  return type.children.some(isChecked);
};

/**
 * Builds the SDL string for each field / type.
 * @param type - Data source object containing a schema field.
 * @param argTree - Arguments tree in case of types with argument presets.
 * @returns SDL string for passed field.
 */
const getSDLField = (
  type: RemoteSchemaFields,
  argTree: Record<string, any> | null
): string => {
  if (!checkEmptyType(type)) return ''; // check if no child is selected for a type

  let result = ``;
  const typeName: string = type.name;

  // add scalar fields to SDL
  if (typeName.startsWith('scalar')) {
    if (checkDefaultGQLScalarType(type.typeName)) return result; // if default GQL scalar type, return empty string
    result = `${typeName}`;
    return `${result}\n`;
  }

  // add other fields to SDL
  result = `${typeName}{`;

  type.children.forEach(f => {
    if (!f.checked) return null;

    let fieldStr = f.name;

    // enum types don't have args
    if (!typeName.startsWith('enum')) {
      if (f.args) {
        fieldStr = `${fieldStr}(`;
        Object.values(f.args).forEach((arg: GraphQLInputField) => {
          let valueStr = `${arg.name} : ${arg.type.inspect()}`;

          if (argTree && argTree[f.name] && argTree[f.name][arg.name]) {
            const argName = argTree[f.name][arg.name];
            let unquoted;
            const isEnum =
              typeof argName === 'string' &&
              argName &&
              !argName.startsWith('x-hasura') &&
              isEnumType(arg.type);

            if (typeof argName === 'object') {
              unquoted = serialiseArgs(argName, arg);
            } else if (typeof argName === 'number') {
              unquoted = `${argName}`;
            } else if (isEnum) {
              unquoted = `${argName}`;
            } else {
              unquoted = `"${argName}"`;
            }

            if (!isEmpty(unquoted))
              valueStr = `${valueStr} @preset(value: ${unquoted})`;
          }

          fieldStr = `${fieldStr + valueStr} `;
        });
        fieldStr = `${fieldStr})`;
        fieldStr = `${fieldStr}: ${f.return}`;
      } else fieldStr = `${fieldStr} : ${f.return}`; // normal data type - ie: without arguments/ presets
    }

    result = `${result}
      ${fieldStr}`;
  });
  return `${result}\n}`;
};

/**
 * Generate SDL string having input types and object types.
 * @param types - Remote schema introspection schema.
 * @returns String having all enum types and scalar types.
 */
export const generateSDL = (
  types: RemoteSchemaFields[],
  argTree: Record<string, any>
) => {
  let result = '';
  const rootsMap: Record<string, any> = {
    'type query_root': false,
    'type mutation_root': false,
  };
  const roots = Object.keys(rootsMap);

  types.forEach(type => {
    const fieldDef = getSDLField(type, argTree);
    if (roots.includes(type.name) && fieldDef) rootsMap[type.name] = true;
    if (fieldDef) result = `${result}\n${fieldDef}\n`;
  });

  if (isEmpty(result))
    return '';

  const prefix = `schema{
    ${rootsMap['type query_root'] ? 'query: query_root' : ''}
    ${rootsMap['type mutation_root'] ? 'mutation: mutation_root' : ''}
  }
  `;

  return `${prefix} ${result}`;
};

export const addPresetDefinition = (schema: string) => `scalar PresetValue\n
  directive @preset(
      value: PresetValue
  ) on INPUT_FIELD_DEFINITION | ARGUMENT_DEFINITION\n
${schema}`;

const addToArrayString = (acc: string, newStr: unknown, withQuotes = false) => {
  if (acc !== '') {
    if (withQuotes) acc = `${acc}, "${newStr}"`;
    else acc = `${acc}, ${newStr}`;
  } else acc = `[${newStr}`;
  return acc;
};

const parseObjectField = (arg: ArgumentNode | ObjectFieldNode) => {
  if (arg?.value?.kind === 'IntValue' && arg?.value?.value)
    return arg?.value?.value;
  if (arg?.value?.kind === 'FloatValue' && arg?.value?.value)
    return arg?.value?.value;
  if (arg?.value?.kind === 'StringValue' && arg?.value?.value)
    return arg?.value?.value;
  if (arg?.value?.kind === 'BooleanValue' && arg?.value?.value)
    return arg?.value?.value;
  if (arg?.value?.kind === 'EnumValue' && arg?.value?.value)
    return arg?.value?.value;

  if (arg?.value?.kind === 'NullValue') return null;

  // nested values
  if (
    arg?.value?.kind === 'ObjectValue' &&
    arg?.value?.fields &&
    arg?.value?.fields?.length > 0
  ) {
    const res: Record<string, any> = {};
    arg?.value?.fields.forEach((f: ObjectFieldNode) => {
      res[f.name.value] = parseObjectField(f);
    });
    return res;
  }

  // Array values
  if (
    arg?.value?.kind === 'ListValue' &&
    arg?.value?.values &&
    arg?.value?.values?.length > 0
  ) {
    let res = '';
    arg.value.values.forEach((v: ValueNode) => {
      if (v.kind === 'IntValue' || v.kind === 'FloatValue') {
        res = addToArrayString(res, v.value);
      } else if (v.kind === 'BooleanValue') {
        res = addToArrayString(res, v.value);
      } else if (v.kind === 'StringValue') {
        res = addToArrayString(res, v.value);
      }
    });
    return `${res}]`;
  }
};

const getDirectives = (field: InputValueDefinitionNode) => {
  let res: unknown | Record<string, any>;
  const preset = field?.directives?.find(dir => dir?.name?.value === 'preset');
  if (preset?.arguments && preset?.arguments[0])
    res = parseObjectField(preset.arguments[0]);
  if (typeof res === 'object') return res;
  if (typeof res === 'string' && isJsonString(res)) return JSON.parse(res);
  return res;
};

const getPresets = (field: FieldDefinitionNode) => {
  const res: Record<string, any> = {};
  field?.arguments?.forEach(arg => {
    if (arg.directives && arg.directives.length > 0)
      res[arg?.name?.value] = getDirectives(arg);
  });
  return res;
};

const getFieldsMap = (fields: FieldDefinitionNode[]) => {
  const res: Record<string, any> = {};
  fields.forEach(field => {
    res[field?.name?.value] = getPresets(field);
  });
  return res;
};

export const getArgTreeFromPermissionSDL = (definition: string) => {
  const roots = ['query_root', 'mutation_root'];
  try {
    const schema: DocumentNode = parse(definition);
    const defs = schema.definitions as ObjectTypeDefinitionNode[];
    const argTree =
      defs &&
      defs.reduce((acc = [], i) => {
        if (i.name && i.fields && roots.includes(i?.name?.value)) {
          const res = getFieldsMap(i.fields as FieldDefinitionNode[]);
          return { ...acc, ...res };
        }
        return acc;
      }, {});
    return argTree;
  } catch (e) {
    console.error(e);
    return {};
  }
};

export const generateTypeString = (str: string) => str.replace(/[^\w\s]/gi, '');

// Removes [,],! from params, and returns a new string
export const getTrimmedReturnType = (value: string): string => {
  const typeName = value.replace(/[[\]!]+/g, '');
  return typeName;
};
