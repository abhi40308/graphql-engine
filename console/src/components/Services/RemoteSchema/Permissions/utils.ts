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
  GraphQLEnumValue,
  GraphQLType,
  GraphQLFieldMap,
  ValueNode,
} from 'graphql';
import {
  isJsonString,
  isEmpty,
  isArrayString,
} from '../../../Common/utils/jsUtils';
import {
  PermissionEdit,
  DatasourceObject,
  FieldType,
  argTreeType,
  Permissions,
} from './types';
import Migration from '../../../../utils/migration/Migration';

export const findRemoteSchemaPermission = (
  perms: Permissions[],
  role: string
) => {
  return perms.find(p => p.role_name === role);
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
  allPermissions: Permissions[],
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
    | undefined = null; // TODO use ternary operator
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
        const args = argArray.reduce((p: argTreeType, c: FieldType) => {
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
 * Sets input and object types in UI tree.
 * @param introspectionSchema - Remote schema introspection schema.
 * @param permissionsSchema - Permissions coming from saved role.
 * @returns Array of all input types and object types
 */
export const getType = (
  introspectionSchema: GraphQLSchema | null,
  permissionsSchema: GraphQLSchema | null
) => {
  const introspectionSchemaFields = introspectionSchema!.getTypeMap();

  let permissionsSchemaFields: any = null; // TODO use ternary operator
  if (permissionsSchema !== null) {
    permissionsSchemaFields = permissionsSchema!.getTypeMap();
  }

  const types: DatasourceObject[] = [];

  Object.entries(introspectionSchemaFields).forEach(([key, value]: any) => {
    if (
      !(
        value instanceof GraphQLObjectType ||
        value instanceof GraphQLInputObjectType
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

    if (name.includes('__')) return; // TODO change this check

    const type: DatasourceObject = {
      name: ``,
      typeName: ``,
      children: [],
    };

    type.typeName = name;
    if (value instanceof GraphQLObjectType) {
      type.name = `type ${name}`;
    } else if (value instanceof GraphQLInputObjectType) {
      type.name = `input ${name}`;
    }

    const childArray: any[] = [];
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

    // checked is true when type is present and the fields are present in type
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
  });
  return types;
};

/**
 * Gets all enum types from introspection schema
 * @param schema - Remote schema introspection schema.
 * @returns Array of all enum types.
 */
const getEnumTypes = (schema: GraphQLSchema) => {
  const fields = schema.getTypeMap();
  const types: DatasourceObject[] = [];
  Object.entries(fields).forEach(([, value]: any) => {
    if (!(value instanceof GraphQLEnumType)) return;
    const name = value.inspect();

    if (name.includes('__')) return; // TODO change this check

    const type: DatasourceObject = {
      name: ``,
      typeName: ``,
      children: [],
    };
    type.typeName = name;
    type.name = `enum ${name}`;

    const childArray: any[] = [];
    const fieldVal = value.getValues();

    Object.entries(fieldVal).forEach(([, v]) => {
      childArray.push({
        name: v.name,
        checked: true,
        return: v.value.toString(),
      });
    });

    type.children = childArray;
    types.push(type);
  });
  return types;
};

/**
 * Gets all scalar types from introspection schema
 * @param schema - Remote schema introspection schema.
 * @returns Array of all scalar types.
 */
export const getScalarTypes = (schema: GraphQLSchema) => {
  const fields = schema.getTypeMap();
  const types: string[] = [];
  const gqlDefaultTypes = ['Boolean', 'Float', 'String', 'Int', 'ID'];
  Object.entries(fields).forEach(([, value]: any) => {
    if (!(value instanceof GraphQLScalarType)) return;
    const name = value.inspect();
    if (gqlDefaultTypes.indexOf(name) > -1) return; // Check if type belongs to default gql scalar types

    const type = `scalar ${name}`;
    types.push(type);
  });
  return types;
};

// method that tells whether the field is nested or not, if nested it returns the children
export const getChildArguments = (v: GraphQLInputField): ChildArgumentType => {
  // TODO check if there are any more possible types with children / expandable views
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

// arg => {id:{_eq:1}}
// argDef => GQL type

const serialiseArgs = (args: argTreeType, argDef: GraphQLInputField) => {
  // console.log(args, argDef);
  let res = '{';
  const { children } = getChildArguments(argDef);
  Object.entries(args).forEach(([key, value]) => {
    if (isEmpty(value) || isEmpty(children)) {
      // if (!children) console.log(key, value, children, argDef, args);
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

/**
 * Checks if the checkbox is checked / unchecked.
 */
const checkNullType = (type: DatasourceObject) => {
  const isChecked = (element: FieldType) => element.checked;
  return type.children.some(isChecked);
};

/**
 * Builds the SDL string for each field / type.
 * @param type - Data source object containing a schema field.
 * @param argTree - Arguments tree in case of types with argument presets.
 * @returns SDL string for passed field.
 */
const getSDLField = (
  type: DatasourceObject,
  argTree: Record<string, any> | null
): string => {
  if (!checkNullType(type)) return '';

  let result = ``;
  const typeName: string = type.name;
  result = `${typeName}{`;

  // if (type.name === 'query_root' || type.name === 'mutation_root')
  //   result = `type ${typeName}{`;
  // else result = `${typeName}{`;

  type.children.forEach(f => {
    // TODO filter selected fields
    if (!f.checked) return null;

    let fieldStr = f.name;

    // this will process all types except enums, enums are processed seperately
    if (!typeName.includes('enum')) {
      if (f?.args) {
        fieldStr = `${fieldStr}(`;
        Object.values(f.args).forEach((arg: GraphQLInputField) => {
          let valueStr = `${arg.name} : ${arg.type.inspect()}`;

          if (argTree && argTree[f.name] && argTree[f.name][arg.name]) {
            const argName = argTree[f.name][arg.name];
            let unquoted;
            if (typeof argName === 'object') {
              unquoted = serialiseArgs(argName, arg);
            } else if (typeof argName === 'number') {
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
 * Gets enum types and scalar types SDL string from introspection schema.
 * @param schema - Remote schema introspection schema.
 * @returns String having all enum types and scalar types.
 */
export const generateConstantTypes = (schema: GraphQLSchema): string => {
  let result = ``;
  const enumTypes = getEnumTypes(schema);
  enumTypes.forEach(type => {
    result = `${result}\n${getSDLField(type, null)}`;
  });
  const scalarTypes = getScalarTypes(schema);
  scalarTypes.forEach(type => {
    result = `${result}\n${type}`;
  });

  return result;
};

/**
 * Generate SDL string having input types and object types.
 * @param types - Remote schema introspection schema.
 * @returns String having all enum types and scalar types.
 */
export const generateSDL = (
  types: DatasourceObject[],
  argTree: Record<string, any>,
  schema: GraphQLSchema
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

  const prefix = `schema{
    ${rootsMap['type query_root'] ? 'query: query_root' : ''}
    ${rootsMap['type mutation_root'] ? 'mutation: mutation_root' : ''}
  }
  `;
  result += generateConstantTypes(schema);
  return `${prefix} ${result}`;
};

type ChildArgumentType = {
  children?: GraphQLInputFieldMap | GraphQLEnumValue[];
  path?: string;
  childrenType?: GraphQLType;
};

// TODO request to add this change on the server.
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
    return null;
  }
};

export const generateTypeString = (str: string) => str.replace(/[^\w\s]/gi, '');

// Removes [,],! from params, and returns a new string
export const getTrimmedReturnType = (value: string): string => {
  const typeName = value.replace(/[[\]!]+/g, '');
  return typeName;
};
